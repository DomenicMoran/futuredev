import { describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { clearPlayback, playLesson, playPlaylist } from './index.js';
import { usePlayerStore } from './store.js';

const h = vi.hoisted(() => ({
  events: new Map<string, ((event: Record<string, unknown>) => void)[]>(),
  added: [] as { id: string; url: string }[],
  resolveA: null as (() => void) | null,
  getAStarted: null as (() => void) | null,
}));
vi.mock('react-native', () => ({ NativeModules: { TrackPlayerModule: {} }, NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } }, DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } }, Platform: { OS: 'ios', Version: 1 }, PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } } }));
vi.mock('react-native/Libraries/Image/resolveAssetSource', () => ({ default: () => null }));
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: async () => undefined, updateOptions: async () => undefined,
    addEventListener: (event: string, callback: (value: Record<string, unknown>) => void) => { const a = h.events.get(event) ?? []; a.push(callback); h.events.set(event, a); return { remove() { return undefined; } }; },
    reset: async () => undefined, getProgress: async () => ({ position: 0, duration: 300 }), add: async (track: { id: string; url: string }) => { h.added.push(track); },
    skip: async () => undefined, seekTo: async () => undefined, setRate: async () => undefined, setVolume: async () => undefined, play: async () => undefined,
  },
  Event: { PlaybackState: 'state', PlaybackError: 'error', PlaybackActiveTrackChanged: 'active' },
  State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('./dataSource.js', () => ({
  getLessonForPlayback: async (id: string) => {
    if (id === 'M01-01-01') {
      h.getAStarted?.();
      await new Promise<void>((resolve) => { h.resolveA = resolve; });
    }
    return { ...makeValidLesson(), id };
  }, markListened: async () => undefined, savePlaybackPosition: async () => undefined,
}));
vi.mock('../data/playlists.js', () => ({ listPlaylistItems: async () => [{ lessonId: 'M01-01-01' }] }));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));

const fs: ContentFs = {
  documentDirectory: 'file:///docs/', ensureDirectory: async () => undefined, writeFile: async () => undefined,
  moveFile: async () => undefined, getFileSize: async () => null, readFilePrefixBase64: async () => '', readFile: async () => '',
  exists: async () => false, listDirectory: async () => [],
};

describe('latest queue replacement intent', () => {
  it('discards a slow playlist start before it can reset/add/play after a newer lesson choice', async () => {
    setContentFs(fs); h.added.length = 0; h.events.clear();
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://audio.test';
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    h.getAStarted = started;
    const older = playPlaylist('playlist-1');
    await startedPromise;
    const newer = playLesson('M01-01-02');
    await newer;
    const finish = h.resolveA;
    if (!finish) throw new Error('Slow lesson was not pending');
    finish();
    await expect(older).rejects.toThrow('Wiedergabeauswahl wurde ersetzt');
    expect(usePlayerStore.getState().queue.items.map((item) => item.lessonId)).toEqual(['M01-01-02']);
    expect(h.added.map((item) => item.id)).toEqual(['M01-01-02']);
    delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
  });

  it('invalidates an older pending lesson before close and does not resurrect its queue', async () => {
    usePlayerStore.getState().reset(); h.added.length = 0;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    h.getAStarted = started;
    const older = playLesson('M01-01-01');
    await startedPromise;
    await playLesson('M01-01-02');
    const closing = clearPlayback();
    const finish = h.resolveA;
    if (!finish) throw new Error('Slow lesson was not pending');
    finish();
    await expect(older).rejects.toThrow('Player-Reset läuft gerade');
    await closing;
    expect(usePlayerStore.getState().queue.items).toHaveLength(0);
    expect(h.added.map((item) => item.id)).toEqual(['M01-01-02']);
    delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
  });
});
