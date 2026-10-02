import { describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { clearPlayerAndDownloads, togglePlayback } from './index.js';
import { usePlayerStore } from './store.js';

const failures = vi.hoisted(() => ({
  play: vi.fn(async () => undefined), reset: vi.fn(async () => undefined),
  setupPlayer: vi.fn().mockRejectedValueOnce(new Error('native setup failed')).mockResolvedValue(undefined),
  updateOptions: vi.fn().mockRejectedValueOnce(new Error('options update failed')).mockResolvedValue(undefined),
  addEventListener: vi.fn(() => ({ remove() { return undefined; } })),
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: failures.setupPlayer, updateOptions: failures.updateOptions,
    addEventListener: failures.addEventListener, reset: failures.reset,
    play: failures.play, setVolume: async () => undefined, setRate: async () => undefined,
    getPlaybackState: async () => ({ state: 'paused' }),
  },
  Event: { PlaybackState: 'playback-state', PlaybackError: 'playback-error', PlaybackActiveTrackChanged: 'active-track' },
  State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({ getLessonForPlayback: async () => ({}), markListened: async () => undefined, savePlaybackPosition: async () => undefined }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));
vi.mock('../data/progress.js', () => ({ drainLessonProgressWrites: async () => undefined }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: async () => undefined }));

const fs: ContentFs = {
  documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined,
  moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '',
  readFile: async () => '', exists: async () => false, listDirectory: async () => [],
};

describe('TrackPlayer setup failure recovery', () => {
  it('retries partial setup without duplicate listeners and lets Delete All proceed', async () => {
    setContentFs(fs);
    await expect(togglePlayback()).rejects.toThrow('native setup failed');
    expect(failures.play).not.toHaveBeenCalled();
    await expect(togglePlayback()).rejects.toThrow('options update failed');
    expect(failures.setupPlayer).toHaveBeenCalledTimes(2);
    await togglePlayback();
    expect(failures.setupPlayer).toHaveBeenCalledTimes(2); // native setup is not repeated after its successful stage
    expect(failures.updateOptions).toHaveBeenCalledTimes(2);
    expect(failures.addEventListener).toHaveBeenCalledTimes(3);
    expect(failures.play).toHaveBeenCalledOnce();
    const reset = clearPlayerAndDownloads();
    await reset.ready;
    expect(failures.reset).toHaveBeenCalledOnce();
    reset.release();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });
});
