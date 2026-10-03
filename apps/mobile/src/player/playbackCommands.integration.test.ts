import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { SOFT_START_RAMP_MS } from './rampVolume.js';
import { jumpBackward, jumpForward, playLesson, setSleepTimer, stopPositionTracking } from './index.js';
import { usePlayerStore } from './store.js';
import { setQueue } from './queue.js';

const native = vi.hoisted(() => ({
  events: new Map<string, ((event: Record<string, unknown>) => void)[]>(),
  play: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
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
    add: async () => undefined,
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
  getLessonForPlayback: async () => makeValidLesson(),
  markListened: async () => undefined,
  savePlaybackPosition: async () => undefined,
}));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));

function emit(name: string, event: Record<string, unknown>): void {
  for (const listener of native.events.get(name) ?? []) listener(event);
}

const fs: ContentFs = {
  documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined,
  moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '',
  readFile: async () => '', exists: async () => false, listDirectory: async () => [],
};

describe('native playback event wins over an older soft-start command', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    native.play.mockClear(); native.pause.mockClear(); native.reset.mockClear(); native.setVolume.mockClear(); native.playbackState = 'paused'; native.position = 0; native.duration = 300;
    usePlayerStore.getState().reset();
    setContentFs(fs);
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://audio.test';
  });
  afterEach(() => { setSleepTimer(null); stopPositionTracking(); vi.useRealTimers(); delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL; });

  it('updates paused UI and accessibility progress immediately after relative seek', async () => {
    usePlayerStore.getState().setQueueState(setQueue([
      { lessonId: 'M01-01-01', title: 'First', durationSeconds: 300 },
    ], 0));
    native.position = 45;
    await jumpForward(30);
    expect(native.seekTo).toHaveBeenLastCalledWith(75);
    expect(usePlayerStore.getState().positionSeconds).toBe(75);
    native.position = 75;
    await jumpBackward(15);
    expect(native.seekTo).toHaveBeenLastCalledWith(60);
    expect(usePlayerStore.getState().positionSeconds).toBe(60);
    native.position = 295;
    await jumpForward(30);
    expect(native.seekTo).toHaveBeenLastCalledWith(300);
    expect(usePlayerStore.getState().positionSeconds).toBe(300);
    native.position = 5;
    await jumpBackward(15);
    expect(native.seekTo).toHaveBeenLastCalledWith(0);
    expect(usePlayerStore.getState().positionSeconds).toBe(0);
  });

  it.each(['remote pause', 'native playback error'])('keeps %s truth when soft-start ramp finishes late', async (eventName) => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    if (eventName === 'remote pause') emit('playback-state', { state: 'paused' });
    else emit('playback-error', { message: 'decoder error', code: 'decoder' });
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isBuffering).toBe(false);
    if (eventName === 'native playback error') expect(usePlayerStore.getState().playbackError).toBe('decoder error');
  });

  it('does not clear buffering merely because the play promise and ramp resolved', async () => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    emit('playback-state', { state: 'buffering' });
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    expect(usePlayerStore.getState().isBuffering).toBe(true);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('cancels end-of-lesson timer when native playback advances to another track', async () => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    setSleepTimer({ kind: 'endOfLesson' });
    expect(usePlayerStore.getState().sleepTimer?.mode.kind).toBe('endOfLesson');
    emit('active-track', { track: { id: 'M01-01-02' } });
    expect(usePlayerStore.getState().sleepTimer).toBeNull();
    expect(native.pause).toHaveBeenCalled();
  });

  it('stops at QueueEnded before repeat-one can restart the same lesson', async () => {
    usePlayerStore.getState().setQueueState(setQueue([{ lessonId: 'M01-01-01', title: 'Lesson', durationSeconds: 300 }]));
    usePlayerStore.getState().setRepeatMode('one');
    usePlayerStore.getState().setPlaying(true);
    setSleepTimer({ kind: 'endOfLesson' });
    const { handlePlaybackQueueEnded } = await import('./trackEnd.js');
    await handlePlaybackQueueEnded();
    expect(native.pause).toHaveBeenCalledOnce();
    expect(native.play).not.toHaveBeenCalled();
    expect(native.seekTo).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().sleepTimer).toBeNull();
  });

  it('stops at QueueEnded before repeat-all can wrap the queue', async () => {
    usePlayerStore.getState().setQueueState(setQueue([
      { lessonId: 'M01-01-01', title: 'First', durationSeconds: 300 },
      { lessonId: 'M01-01-02', title: 'Last', durationSeconds: 300 },
    ], 1));
    usePlayerStore.getState().setRepeatMode('all');
    usePlayerStore.getState().setPlaying(true);
    setSleepTimer({ kind: 'endOfLesson' });
    const { handlePlaybackQueueEnded } = await import('./trackEnd.js');
    await handlePlaybackQueueEnded();
    expect(native.pause).toHaveBeenCalledOnce();
    expect(native.play).not.toHaveBeenCalled();
    expect(native.seekTo).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().sleepTimer).toBeNull();
  });

  it('keeps end timer through pause and recomputes from native seek/rate on resume', async () => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    native.position = 100;
    native.duration = 160;
    usePlayerStore.getState().setRate(2);
    setSleepTimer({ kind: 'endOfLesson' });
    native.playbackState = 'paused';
    usePlayerStore.getState().setPlaying(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(usePlayerStore.getState().sleepTimer?.mode.kind).toBe('endOfLesson');
    native.playbackState = 'playing';
    usePlayerStore.getState().setPlaying(true);
    native.position = 120;
    await vi.advanceTimersByTimeAsync(1000);
    expect(usePlayerStore.getState().sleepTimer?.target.endsAtMs).toBe(Date.now() + 20_000);
  });

});
