import { describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { PlaybackService } from './service.js';
import { clearPlayerAndDownloads } from './index.js';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (payload?: { position?: number; paused?: boolean }) => void>(),
  play: vi.fn(async () => undefined), pause: vi.fn(async () => undefined),
  setVolume: vi.fn(async () => undefined), setRate: vi.fn(async () => undefined),
  seekTo: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined), deleteStarted: null as (() => void) | null,
  finishDelete: null as (() => void) | null,
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: {
    addEventListener: (name: string, fn: (payload?: { position?: number; paused?: boolean }) => void) => { h.handlers.set(name, fn); return { remove() { return undefined; } }; },
    setupPlayer: async () => undefined, updateOptions: async () => undefined, reset: h.reset,
    add: async () => undefined, play: h.play, pause: h.pause, setVolume: h.setVolume, setRate: h.setRate, seekTo: h.seekTo,
    getPlaybackState: async () => ({ state: 'paused' }), getProgress: async () => ({ position: 0, duration: 0 }),
  },
  Event: { RemotePlay: 'remote-play', RemotePause: 'remote-pause', RemoteStop: 'remote-stop', RemoteNext: 'remote-next', RemotePrevious: 'remote-previous', RemoteSeek: 'remote-seek', RemoteJumpForward: 'remote-jump-forward', RemoteJumpBackward: 'remote-jump-backward', RemoteDuck: 'remote-duck', PlaybackQueueEnded: 'queue-ended', PlaybackActiveTrackChanged: 'active' },
  State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({ getLessonForPlayback: async () => ({}), markListened: async () => undefined, savePlaybackPosition: async () => undefined }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));
vi.mock('../data/progress.js', () => ({ drainLessonProgressWrites: async () => undefined }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: async () => { h.deleteStarted?.(); await new Promise<void>((resolve) => { h.finishDelete = resolve; }); } }));

const fs: ContentFs = { documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined, moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '', readFile: async () => '', exists: async () => false, listDirectory: async () => [] };

describe('native remote service handlers', () => {
  it('routes remote pause/resume through lifecycle API and restores audible volume on resume', async () => {
    setContentFs(fs); h.handlers.clear(); h.play.mockClear(); h.pause.mockClear(); h.setVolume.mockClear();
    await PlaybackService();
    h.handlers.get('remote-pause')?.();
    await vi.waitFor(() => expect(h.pause).toHaveBeenCalledOnce());
    h.handlers.get('remote-play')?.();
    await vi.waitFor(() => expect(h.play).toHaveBeenCalledOnce());
    expect(h.setVolume).toHaveBeenCalledWith(1);
    expect(h.setRate).toHaveBeenCalledWith(1);
  });

  it('absorbs remote events during reset without post-reset player commands or unhandled rejection', async () => {
    setContentFs(fs); h.handlers.clear(); h.play.mockClear(); h.setVolume.mockClear(); h.seekTo.mockClear();
    let deleteStarted!: () => void;
    const started = new Promise<void>((resolve) => { deleteStarted = resolve; });
    h.deleteStarted = deleteStarted;
    await PlaybackService();
    const reset = clearPlayerAndDownloads();
    await started;
    h.handlers.get('remote-play')?.();
    h.handlers.get('remote-seek')?.({ position: 42 });
    h.handlers.get('queue-ended')?.();
    h.finishDelete?.();
    await reset.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.play).not.toHaveBeenCalled();
    expect(h.setVolume).not.toHaveBeenCalled();
    expect(h.seekTo).not.toHaveBeenCalled();
    reset.release();
  });
});
