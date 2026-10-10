import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from './store.js';
import { handlePlaybackQueueEnded, syncActiveTrackIndex } from './trackEnd.js';

const h = vi.hoisted(() => ({ skip: vi.fn(), play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), track: vi.fn(), stop: vi.fn(), save: vi.fn(), heard: vi.fn(async () => null) }));
vi.mock('react-native-track-player', () => ({ default: { skip: h.skip, play: h.play, pause: h.pause, seekTo: h.seekTo } }));
vi.mock('./index.js', () => ({ runPlayerOperation: async (work: () => Promise<void>) => work(), startPositionTracking: h.track, stopPositionTracking: h.stop, setSleepTimer: () => usePlayerStore.getState().setSleepTimer(null) }));
vi.mock('./dataSource.js', () => ({ savePlaybackPosition: h.save, markListened: vi.fn() }));
vi.mock('./hearingProgress.js', () => ({ recordHearingSample: h.heard, resetHearingBaseline: vi.fn() }));

describe('real track boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks(); usePlayerStore.getState().reset();
    usePlayerStore.getState().setQueueState({ items: [{ lessonId: 'a', title: 'A', durationSeconds: 1028 }, { lessonId: 'b', title: 'B', durationSeconds: 1024 }], currentIndex: 0 });
  });
  it('advances the decoder, not merely the UI, if a queue-end arrives before native advancement', async () => {
    await handlePlaybackQueueEnded(1028);
    expect(h.skip).toHaveBeenCalledWith(1); expect(h.play).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().queue.currentIndex).toBe(1);
  });
  it('saves the outgoing native position and starts tracking the next title', async () => {
    await syncActiveTrackIndex('b', 'a', 1028);
    expect(h.save).toHaveBeenCalledWith('a', 1028);
    expect(h.track).toHaveBeenCalledWith('b');
    expect(h.pause).not.toHaveBeenCalled();
  });
  it('honors autoplay off on native automatic transition', async () => {
    usePlayerStore.getState().setAutoplayNext(false);
    await syncActiveTrackIndex('b', 'a', 1028);
    expect(h.pause).toHaveBeenCalledOnce();
  });
  it('repeats one at an intra-module boundary rather than playing the next lesson', async () => {
    usePlayerStore.getState().setRepeatMode('one');
    await syncActiveTrackIndex('b', 'a', 1028);
    expect(h.skip).toHaveBeenCalledWith(0);
    expect(h.seekTo).toHaveBeenCalledWith(0);
    expect(h.play).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().queue.currentIndex).toBe(0);
  });
  it('does not pause a manual early skip when autoplay is off', async () => {
    usePlayerStore.getState().setAutoplayNext(false);
    await syncActiveTrackIndex('b', 'a', 10);
    expect(h.pause).not.toHaveBeenCalled();
  });
  it('stops cleanly at the last title without a phantom advance', async () => {
    usePlayerStore.getState().setQueueState({ ...usePlayerStore.getState().queue, currentIndex: 1 });
    await handlePlaybackQueueEnded(1024);
    expect(h.play).not.toHaveBeenCalled(); expect(h.stop).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });
});
