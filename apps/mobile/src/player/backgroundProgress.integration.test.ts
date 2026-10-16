import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackService } from './service.js';
import { clearPlayerAndDownloads, setSleepTimer, saveNativePlaybackProgress, seekToSeconds, startPositionTracking, stopPositionTracking } from './index.js';
import { usePlayerStore } from './store.js';
import { beginHearing, listHearingProgress } from './hearingProgress.js';
import { resetToMemoryDatabase } from '../data/db.js';
import { setContentFs } from '../content/contentFs.js';
import type { ContentFs } from '../content/types.js';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (event: { track: number; position: number; duration: number }) => void>(),
  active: vi.fn(async (): Promise<{ id: string }> => ({ id: 'a' })),
  save: vi.fn(async (): Promise<void> => undefined),
  pause: vi.fn(async () => undefined), volume: vi.fn(async () => undefined),
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: { getProgress: async () => ({ position: 0, duration: 600 }), getActiveTrack: () => h.active() } }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: {
    addEventListener: (name: string, handler: (event: { track: number; position: number; duration: number }) => void) => { h.handlers.set(name, handler); },
    pause: h.pause, setVolume: h.volume,
    getActiveTrack: h.active, getProgress: async () => ({ position: 0, duration: 600 }), seekTo: async () => undefined,
  },
  Event: { PlaybackProgressUpdated: 'progress', RemotePlay: 'play', RemotePause: 'pause', RemoteStop: 'stop', RemoteNext: 'next', RemotePrevious: 'previous', RemoteSeek: 'seek', RemoteJumpForward: 'forward', RemoteJumpBackward: 'backward', RemoteDuck: 'duck', PlaybackQueueEnded: 'end', PlaybackActiveTrackChanged: 'active' },
}));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: async () => undefined }));
vi.mock('./dataSource.js', () => ({ getLessonForPlayback: async () => ({}), savePlaybackPosition: h.save, markListened: async () => undefined }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: () => undefined, clearListenProgressBaselines: () => undefined }));
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(0); resetToMemoryDatabase();
  setContentFs({ documentDirectory: 'file:///background/' } as ContentFs);
  h.pause.mockClear(); h.volume.mockClear();
  h.active.mockReset().mockResolvedValue({ id: 'a' }); h.save.mockReset().mockResolvedValue(undefined); h.handlers.clear();
  usePlayerStore.getState().reset();
  usePlayerStore.getState().setQueueState({ items: [{ lessonId: 'a', title: 'A', durationSeconds: 600 }, { lessonId: 'b', title: 'B', durationSeconds: 600 }], currentIndex: 0 });
  usePlayerStore.getState().setPlaying(true);
  await import('react-native-track-player');
  startPositionTracking('a'); await vi.waitFor(() => { expect(usePlayerStore.getState().playbackError).toBeNull(); expect(h.active).toHaveBeenCalled(); }, { timeout: 10_000 }); await tick(); vi.setSystemTime(0); beginHearing('a', 0, true, 0); await PlaybackService();
});
afterEach(() => { setSleepTimer(null); stopPositionTracking(); vi.useRealTimers(); });

describe('native service progress while JS timers are suspended', () => {
  it('restores audible volume when the user cancels during the fade', async () => {
    setSleepTimer({ kind: 'minutes', minutes: 15 });
    vi.setSystemTime(896_000);
    h.handlers.get('progress')?.({ track: 0, position: 300, duration: 600 }); await tick();
    expect(h.volume).toHaveBeenLastCalledWith(0.5);
    setSleepTimer(null); await tick();
    expect(h.volume).toHaveBeenLastCalledWith(1);
    expect(h.pause).not.toHaveBeenCalled();
  });
  it('expires the minute timer via native events while every JS interval is suspended', async () => {
    setSleepTimer({ kind: 'minutes', minutes: 15 });
    vi.setSystemTime(896_000);
    h.handlers.get('progress')?.({ track: 0, position: 300, duration: 600 }); await tick();
    expect(h.volume).toHaveBeenLastCalledWith(0.5);
    expect(h.pause).not.toHaveBeenCalled();
    h.save.mockRejectedValueOnce(new Error('storage unavailable'));
    vi.setSystemTime(900_000);
    h.handlers.get('progress')?.({ track: 0, position: 306, duration: 600 }); await tick();
    expect(h.pause).toHaveBeenCalledOnce();
    expect(h.volume).toHaveBeenLastCalledWith(1);
    expect(usePlayerStore.getState().sleepTimer).toBeNull();
  });

  it('persists position and coverage via service events without firing any JS interval', async () => {
    // setSystemTime deliberately does not run the foreground five-second interval.
    vi.setSystemTime(60_000);
    h.handlers.get('progress')?.({ track: 0, position: 60, duration: 600 }); await tick();
    expect(h.save).toHaveBeenCalledWith('a', 60);
    expect((await listHearingProgress()).a?.seconds).toBe(60);
    vi.setSystemTime(360_000);
    h.handlers.get('progress')?.({ track: 0, position: 360, duration: 600 }); await tick();
    expect(h.save).toHaveBeenLastCalledWith('a', 360);
    expect((await listHearingProgress()).a?.seconds).toBe(360);
  });
  it('throttles frequent native events to one write per five seconds', async () => {
    await saveNativePlaybackProgress({ track: 0, position: 0, duration: 600 });
    vi.setSystemTime(1000); await saveNativePlaybackProgress({ track: 0, position: 1, duration: 600 });
    expect(h.save).toHaveBeenCalledTimes(1);
    vi.setSystemTime(5000); await saveNativePlaybackProgress({ track: 0, position: 5, duration: 600 });
    expect(h.save).toHaveBeenCalledTimes(2);
  });
  it('rejects mismatched native track indices and a native transition ahead of the store', async () => {
    await saveNativePlaybackProgress({ track: 1, position: 10, duration: 600 });
    h.active.mockResolvedValue({ id: 'b' });
    await saveNativePlaybackProgress({ track: 0, position: 10, duration: 600 });
    expect(h.save).not.toHaveBeenCalled(); expect(await listHearingProgress()).toEqual({});
  });
  it.each(['stop', 'seek'])('discards an in-flight sample invalidated by %s', async (action) => {
    let resolve!: (value: { id: string }) => void;
    h.active.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    vi.setSystemTime(10_000);
    const sample = saveNativePlaybackProgress({ track: 0, position: 10, duration: 600 }); await tick();
    if (action === 'stop') stopPositionTracking(); else await seekToSeconds(500);
    resolve({ id: 'a' }); await sample;
    expect(h.save).not.toHaveBeenCalled(); expect(await listHearingProgress()).toEqual({});
  });
  it('keeps reset pending until an in-flight native position write drains', async () => {
    let finish!: () => void;
    h.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.setSystemTime(10_000);
    const sample = saveNativePlaybackProgress({ track: 0, position: 10, duration: 600 }); await tick();
    expect(h.save).toHaveBeenCalledOnce();
    const lease = clearPlayerAndDownloads(); let ready = false;
    void lease.ready.then(() => { ready = true; }); await tick();
    expect(ready).toBe(false);
    await saveNativePlaybackProgress({ track: 0, position: 20, duration: 600 });
    expect(h.save).toHaveBeenCalledOnce();
    finish(); await sample; await lease.ready; lease.release();
    expect(ready).toBe(true);
  });
  it('contains a service write failure and accepts later native events', async () => {
    h.save.mockRejectedValueOnce(new Error('storage unavailable'));
    vi.setSystemTime(10_000);
    h.handlers.get('progress')?.({ track: 0, position: 10, duration: 600 }); await tick();
    vi.setSystemTime(20_000);
    await saveNativePlaybackProgress({ track: 0, position: 20, duration: 600 });
    expect(h.save).toHaveBeenCalledTimes(2);
    expect((await listHearingProgress()).a?.seconds).toBe(20);
  });

});
