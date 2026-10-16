import { resetToMemoryDatabase } from '../data/db.js';
import { loadPlayerPreferences } from './playerPreferences.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { SOFT_START_RAMP_MS } from './rampVolume.js';
import { jumpBackward, jumpForward, playLesson, removeFromQueue, reorderQueue, setRate, setSleepTimer, stopPositionTracking } from './index.js';
import { usePlayerStore } from './store.js';
import { setQueue } from './queue.js';

const native = vi.hoisted(() => ({
  events: new Map<string, ((event: Record<string, unknown>) => void)[]>(),
  play: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  remove: vi.fn(async (_index: number) => undefined), move: vi.fn(async (_from: number, _to: number) => undefined), skip: vi.fn(async (_index: number, _position?: number) => undefined),
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
    skip: native.skip, remove: native.remove, move: native.move,
    seekTo: native.seekTo,
    setRate: async () => undefined,
    setVolume: native.setVolume,
    play: native.play,
    pause: native.pause,
    getPlaybackState: async () => ({ state: native.playbackState }),
    getProgress: async () => ({ position: native.position, duration: native.duration }),
  },
  Event: { PlaybackQueueEnded: 'queue-ended', PlaybackState: 'playback-state', PlaybackError: 'playback-error', PlaybackActiveTrackChanged: 'active-track', PlaybackProgressUpdated: 'progress' },
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
    native.remove.mockReset().mockResolvedValue(undefined); native.move.mockReset().mockResolvedValue(undefined); native.skip.mockReset().mockResolvedValue(undefined);
    native.play.mockClear(); native.seekTo.mockClear(); native.pause.mockClear(); native.reset.mockClear(); native.setVolume.mockClear(); native.playbackState = 'paused'; native.position = 0; native.duration = 300;
    usePlayerStore.getState().reset();
    setContentFs(fs);
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://audio.test';
  });
  afterEach(() => { setSleepTimer(null); stopPositionTracking(); vi.useRealTimers(); delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL; });

  it('edits both native and visible queues, without removing the playing item by accident', async () => {
    const items = ['a', 'b', 'c'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 }));
    usePlayerStore.getState().setQueueState(setQueue(items, 1));
    await removeFromQueue(0);
    expect(native.remove).toHaveBeenCalledWith(0);
    expect(usePlayerStore.getState().queue).toEqual(setQueue(items.slice(1), 0));
    await reorderQueue(0, 1);
    expect(native.move).toHaveBeenCalledWith(0, 1);
    expect(usePlayerStore.getState().queue.currentIndex).toBe(1);
    expect(usePlayerStore.getState().queue.items.map(i => i.lessonId)).toEqual(['c', 'b']);
  });
  it('does not change the visible queue when the native removal fails', async () => {
    const queue = setQueue([{ lessonId: 'a', title: 'A', durationSeconds: 300 }]);
    usePlayerStore.getState().setQueueState(queue);
    native.remove.mockRejectedValueOnce(new Error('native failure'));
    await expect(removeFromQueue(0)).rejects.toThrow('native failure');
    expect(usePlayerStore.getState().queue).toBe(queue);
  });
  it('removes the final item natively, stops tracking and leaves an honest empty player', async () => {
    usePlayerStore.getState().setQueueState(setQueue([{ lessonId: 'a', title: 'A', durationSeconds: 300 }]));
    usePlayerStore.getState().setPlaying(true);
    await removeFromQueue(0);
    expect(native.remove).toHaveBeenCalledWith(0);
    expect(usePlayerStore.getState().queue.items).toEqual([]);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('ignores the native queue-ended event caused by removal instead of restarting repeat-one', async () => {
    const { PlaybackService } = await import('./service.js');
    await PlaybackService();
    usePlayerStore.getState().setQueueState(setQueue(['a', 'b'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 })), 1));
    usePlayerStore.getState().setRepeatMode('one');
    native.remove.mockImplementationOnce(async () => {
      emit('queue-ended', { position: 0 });
      await Promise.resolve();
    });
    await removeFromQueue(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(native.play).not.toHaveBeenCalled();
    expect(native.pause).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('ignores a delayed zero-position ended event after native removal has settled', async () => {
    usePlayerStore.getState().setQueueState(setQueue([{ lessonId: 'a', title: 'A', durationSeconds: 300 }]));
    usePlayerStore.getState().setRepeatMode('one');
    const { handlePlaybackQueueEnded } = await import('./trackEnd.js');
    await handlePlaybackQueueEnded(0);
    expect(native.play).not.toHaveBeenCalled();
    expect(native.seekTo).not.toHaveBeenCalled();
  });

  it('selects the survivor before removing the active last item to avoid native asynchronous auto-start', async () => {
    const items = ['a', 'b', 'c'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 }));
    usePlayerStore.getState().setQueueState(setQueue(items, 2));
    await removeFromQueue(2);
    expect(usePlayerStore.getState().queue).toEqual(setQueue(items.slice(0, 2), 0));
    expect(native.skip).toHaveBeenCalledWith(0, 0);
    expect(native.pause).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().positionSeconds).toBe(0);
  });
  it('does not remove anything when selecting the survivor fails', async () => {
    const queue = setQueue(['a', 'b'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 })), 1);
    usePlayerStore.getState().setQueueState(queue);
    native.skip.mockRejectedValueOnce(new Error('skip failed'));
    await expect(removeFromQueue(1)).rejects.toThrow('skip failed');
    expect(native.remove).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queue).toBe(queue);
  });
  it('retains the successful survivor selection if removal then fails', async () => {
    const queue = setQueue(['a', 'b'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 })), 1);
    usePlayerStore.getState().setQueueState(queue);
    native.remove.mockRejectedValueOnce(new Error('remove failed'));
    await expect(removeFromQueue(1)).rejects.toThrow('remove failed');
    expect(usePlayerStore.getState().queue).toEqual({ ...queue, currentIndex: 0 });
    expect(usePlayerStore.getState().positionSeconds).toBe(0);
  });

  it('serializes simultaneous removals by item identity rather than stale indexes', async () => {
    const items = ['a', 'b', 'c'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 }));
    usePlayerStore.getState().setQueueState(setQueue(items, 2));
    await Promise.all([removeFromQueue(0), removeFromQueue(1)]);
    expect(native.remove.mock.calls.map(call => call[0])).toEqual([0, 0]);
    expect(usePlayerStore.getState().queue).toEqual(setQueue(items.slice(2), 0));
  });
  it('keeps the visible order intact when a native move fails', async () => {
    const items = ['a', 'b'].map(lessonId => ({ lessonId, title: lessonId, durationSeconds: 300 }));
    const queue = setQueue(items);
    usePlayerStore.getState().setQueueState(queue);
    native.move.mockRejectedValueOnce(new Error('move failed'));
    await expect(reorderQueue(0, 1)).rejects.toThrow('move failed');
    expect(usePlayerStore.getState().queue).toBe(queue);
  });

  it('persists the speed through the actual player command and reports a failed save honestly', async () => {
    const db = resetToMemoryDatabase();
    await setRate(1.5);
    expect(usePlayerStore.getState().rate).toBe(1.5);
    expect((await loadPlayerPreferences()).rate).toBe(1.5);
    const write = db.setSetting;
    db.setSetting = async () => { throw new Error('SQLITE_FULL'); };
    await expect(setRate(1.6)).rejects.toThrow('Tempo wurde geändert');
    expect(usePlayerStore.getState().rate).toBe(1.6);
    db.setSetting = write;
    expect((await loadPlayerPreferences()).rate).toBe(1.5);
  });

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

  it('keeps the volume ramp and progress tracking through delayed native ready events', async () => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    emit('playback-state', { state: 'ready' });
    emit('playback-state', { state: 'playing' });
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    expect(native.setVolume).toHaveBeenLastCalledWith(1);
    native.position = 12;
    await vi.advanceTimersByTimeAsync(500);
    expect(usePlayerStore.getState().positionSeconds).toBe(12);
  });

  it('cancels end-of-lesson timer when native playback advances to another track', async () => {
    const command = playLesson('M01-01-01');
    await vi.waitFor(() => expect(native.play).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(SOFT_START_RAMP_MS + 30);
    await command;
    setSleepTimer({ kind: 'endOfLesson' });
    expect(usePlayerStore.getState().sleepTimer?.mode.kind).toBe('endOfLesson');
    usePlayerStore.getState().setQueueState(setQueue([
      { lessonId: 'M01-01-01', title: 'First', durationSeconds: 300 },
      { lessonId: 'M01-01-02', title: 'Next', durationSeconds: 300 },
    ]));
    const { syncActiveTrackIndex } = await import('./trackEnd.js');
    await syncActiveTrackIndex('M01-01-02');
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
