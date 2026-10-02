import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { clearPlayerAndDownloads, playLesson, saveCurrentPositionNow } from './index.js';
import { usePlayerStore } from './store.js';

const native = vi.hoisted(() => ({
  add: vi.fn(async (): Promise<void> => undefined),
  play: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  getProgress: vi.fn(async () => ({ position: 7, duration: 300 })),
}));
const progressMock = vi.hoisted(() => ({ save: vi.fn(async () => undefined) }));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: async () => undefined }));
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: async () => undefined, updateOptions: async () => undefined,
    addEventListener: () => ({ remove: () => undefined }),
    reset: native.reset, add: native.add, play: native.play, getProgress: native.getProgress, setVolume: async () => undefined,
    setRate: async () => undefined, seekTo: async () => undefined, skip: async () => undefined, pause: async () => undefined,
  },
  Event: { PlaybackState: 'playback-state', PlaybackError: 'playback-error', PlaybackActiveTrackChanged: 'active-track', PlaybackProgressUpdated: 'progress' },
  State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' }, IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({ getLessonForPlayback: async () => makeValidLesson(), savePlaybackPosition: progressMock.save, markListened: async () => undefined }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));

const fs: ContentFs = {
  documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined,
  moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '',
  readFile: async () => '', exists: async () => false, listDirectory: async () => [],
};

describe('player lifecycle reset barriers', () => {
  afterEach(() => { delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL; });

  it('invalidates and drains a delayed queue start before native reset', async () => {
    let releaseAdd!: () => void;
    const pendingAdd = new Promise<void>((resolve) => { releaseAdd = resolve; });
    native.add.mockImplementationOnce(() => pendingAdd);
    setContentFs(fs);
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://audio.test';
    const start = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.add).toHaveBeenCalledOnce());
    const reset = clearPlayerAndDownloads();
    releaseAdd();
    await expect(start).rejects.toThrow('Player-Reset');
    await reset.ready;
    reset.release();
    expect(native.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queue.items).toEqual([]);
  });

  it('drains a paused immediate-save waiter and prevents its post-reset write', async () => {
    let releaseProgress!: (value: { position: number; duration: number }) => void;
    native.getProgress.mockImplementationOnce(() => new Promise((resolve) => { releaseProgress = resolve; }));
    setContentFs(fs);
    const pauseSave = saveCurrentPositionNow('M01-01-01');
    await vi.waitFor(() => expect(native.getProgress).toHaveBeenCalled());
    const reset = clearPlayerAndDownloads();
    releaseProgress({ position: 42, duration: 300 });
    await Promise.all([pauseSave, reset.ready]);
    reset.release();
    expect(progressMock.save).not.toHaveBeenCalled();
  });
});
