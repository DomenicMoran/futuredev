import { describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { clearPlayback, clearPlayerAndDownloads, downloadLesson, resumePlayback } from './index.js';

const h = vi.hoisted(() => ({
  reset: vi.fn(async (): Promise<void> => undefined), play: vi.fn(async (): Promise<void> => undefined),
  setup: vi.fn(async (): Promise<void> => undefined),
  deleteAsync: vi.fn(async () => undefined),
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: { setupPlayer: h.setup, updateOptions: async () => undefined, addEventListener: () => ({ remove() { return undefined; } }), reset: h.reset, play: h.play, pause: async () => undefined, setVolume: async () => undefined, setRate: async () => undefined },
  Event: { PlaybackState: 'state', PlaybackError: 'error', PlaybackActiveTrackChanged: 'active' }, State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' }, Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 }, IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({ getLessonForPlayback: async () => ({}), markListened: async () => undefined, savePlaybackPosition: async () => undefined }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));
vi.mock('../data/progress.js', () => ({ drainLessonProgressWrites: async () => undefined }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: h.deleteAsync }));

const fs: ContentFs = { documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined, moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '', readFile: async () => '', exists: async () => false, listDirectory: async () => [] };

describe('close and delete-all share token-owned lifecycle barriers', () => {
  it('keeps the Delete All gate through Close→DeleteAll transitions and repeated close', async () => {
    setContentFs(fs); h.reset.mockReset(); h.play.mockClear();
    let releaseClose!: () => void;
    const closeNativeReset = new Promise<void>((resolve) => { releaseClose = resolve; });
    h.reset.mockImplementationOnce(() => closeNativeReset);
    const close = clearPlayback();
    await vi.waitFor(() => expect(h.reset).toHaveBeenCalledOnce());
    const repeatedClose = clearPlayback();
    const wipe = clearPlayerAndDownloads();
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    await expect(downloadLesson('M01-01-01')).rejects.toThrow('Player-Reset läuft');
    releaseClose();
    await Promise.all([close, repeatedClose]);
    await wipe.ready;
    expect(h.reset).toHaveBeenCalledTimes(2); // one close transition, one serialized Delete All transition
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    await expect(downloadLesson('M01-01-01')).rejects.toThrow('Player-Reset läuft');
    wipe.release();
    await resumePlayback();
    expect(h.play).toHaveBeenCalledOnce();
  });

  it('keeps the wipe lease through DeleteAll→Close, and Close cannot release it', async () => {
    setContentFs(fs); h.reset.mockClear(); h.play.mockClear();
    const wipe = clearPlayerAndDownloads();
    await wipe.ready;
    await clearPlayback();
    expect(h.reset).toHaveBeenCalledOnce();
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    await expect(downloadLesson('M01-01-01')).rejects.toThrow('Player-Reset läuft');
    wipe.release();
    await resumePlayback();
    expect(h.play).toHaveBeenCalledOnce();
  });

  it('requires every concurrent wipe owner to release its own lease', async () => {
    setContentFs(fs); h.deleteAsync.mockResolvedValue(undefined);
    const first = clearPlayerAndDownloads();
    const second = clearPlayerAndDownloads();
    await Promise.all([first.ready, second.ready]);
    first.release();
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    second.release();
    await resumePlayback();
  });

  it('keeps the barrier after preparation failure until the owner releases it', async () => {
    setContentFs(fs); h.deleteAsync.mockRejectedValueOnce(new Error('audio cache cleanup failed'));
    const wipe = clearPlayerAndDownloads();
    await expect(wipe.ready).rejects.toThrow('audio cache cleanup failed');
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    wipe.release();
    await resumePlayback();
  });

  it('releases a failed Close transition without releasing a subsequently acquired wipe barrier', async () => {
    setContentFs(fs); h.reset.mockRejectedValueOnce(new Error('native close reset failed'));
    await clearPlayback();
    const wipe = clearPlayerAndDownloads();
    await wipe.ready;
    await expect(resumePlayback()).rejects.toThrow('Player-Reset läuft');
    wipe.release();
    await resumePlayback();
  });
});
