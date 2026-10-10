import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { playLessonInModuleContext, resumeLessonInModuleContext, resumePlayback, setSleepTimer, stopPositionTracking } from './index.js';
import { usePlayerStore } from './store.js';

const native = vi.hoisted(() => ({
  events: new Map<string, ((event: Record<string, unknown>) => void)[]>(),
  play: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  reset: vi.fn(async () => { native.active = undefined; }),
  active: undefined as string | undefined,
  add: vi.fn(async (track: { id: string }) => { native.active ??= track.id; }),
  getActiveTrack: vi.fn(async (): Promise<{ id: string } | undefined> => native.active ? { id: native.active } : undefined),
  seekTo: vi.fn(async () => undefined),
  setVolume: vi.fn(async () => undefined),
  playbackState: 'paused' as string,
  position: 0,
  duration: 300,
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: async () => undefined,
    updateOptions: async () => undefined,
    addEventListener: (event: string, callback: (value: Record<string, unknown>) => void) => {
      const listeners = native.events.get(event) ?? [];
      listeners.push(callback);
      native.events.set(event, listeners);
      return { remove: () => undefined };
    },
    reset: native.reset,
    add: native.add,
    getActiveTrack: native.getActiveTrack,
    skip: async () => undefined,
    seekTo: native.seekTo,
    setRate: async () => undefined,
    setVolume: native.setVolume,
    play: native.play,
    pause: native.pause,
    getPlaybackState: async () => ({ state: native.playbackState }),
    getProgress: async () => ({ position: native.position, duration: native.duration }),
  },
  Event: { PlaybackState: 'playback-state', PlaybackError: 'playback-error', PlaybackActiveTrackChanged: 'active-track', PlaybackProgressUpdated: 'progress' },
  State: { None: 'none', Ready: 'ready', Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Paused: 'paused', Stopped: 'stopped', Error: 'error' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' }, IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({
  getLessonForPlayback: async (id: string) => ({ ...makeValidLesson(), id }),
  markListened: async () => undefined,
  savePlaybackPosition: async () => undefined,
}));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));


const fs: ContentFs = {
  documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined,
  moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '',
  readFile: async () => '', exists: async () => false, listDirectory: async () => [],
};

vi.mock('./moduleLessonIds.js', () => ({ lessonIdsFromLessonInModule: async (id: string) => [id, id + '-next'], lessonIdsInModule: async () => [] }));

describe('atomic module continuation', () => {
  beforeEach(() => {
    native.play.mockClear(); native.reset.mockClear(); native.seekTo.mockClear(); native.add.mockClear(); native.getActiveTrack.mockClear(); native.active = undefined;
    usePlayerStore.getState().reset(); setContentFs(fs); process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://audio.test';
  });
  afterEach(() => { setSleepTimer(null); stopPositionTracking(); delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL; });
  it('seeks to the saved position before the first play and queues subsequent lessons', async () => {
    await resumeLessonInModuleContext('M01-01-01', 210);
    expect(native.seekTo).toHaveBeenCalledWith(210);
    expect(native.seekTo.mock.invocationCallOrder[0]).toBeLessThan(native.play.mock.invocationCallOrder[0] ?? 0);
    expect(usePlayerStore.getState().queue.items.map(item => item.lessonId)).toEqual(['M01-01-01', 'M01-01-01-next']);
    expect(usePlayerStore.getState().positionSeconds).toBe(210);
  });
  it('preserves the live queue and position when continuing the same paused lesson', async () => {
    await resumeLessonInModuleContext('M01-01-01', 210);
    const queue = usePlayerStore.getState().queue; const resets = native.reset.mock.calls.length;
    await resumeLessonInModuleContext('M01-01-01', 12);
    expect(native.reset).toHaveBeenCalledTimes(resets);
    expect(usePlayerStore.getState().queue).toBe(queue);
    expect(native.seekTo).toHaveBeenCalledTimes(1);
  });
  it('rebuilds an absent native queue rather than reporting play on an empty player', async () => {
    await resumeLessonInModuleContext('M01-01-01', 210);
    native.active = undefined; native.add.mockClear(); native.play.mockClear(); native.seekTo.mockClear();
    usePlayerStore.getState().setPosition(210); usePlayerStore.getState().setPlaybackError('initial setup failure');
    await resumePlayback();
    expect(native.add).toHaveBeenCalledTimes(2); expect(native.play).toHaveBeenCalledOnce();
    expect(native.seekTo).toHaveBeenCalledWith(210);
    expect(native.add.mock.invocationCallOrder[1]).toBeLessThan(native.play.mock.invocationCallOrder[0] ?? 0);
  });
  it('a delayed recovery cannot supersede a newer lesson selection', async () => {
    await resumeLessonInModuleContext('M01-01-01', 210);
    let release: ((value: undefined) => void) | undefined;
    native.getActiveTrack.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const retry = resumePlayback();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await playLessonInModuleContext('M02-01-01');
    release?.(undefined); await retry;
    expect(usePlayerStore.getState().queue.items[0]?.lessonId).toBe('M02-01-01');
  });
});
