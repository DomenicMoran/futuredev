import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentSnapshot } from '../content/generation.js';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import {
  clearCueSheetCache,
  clearPlayback,
  playLesson,
  seekToBlock,
  seekToSeconds,
  stopPositionTracking,
} from './index.js';
import { usePlayerStore } from './store.js';

const native = vi.hoisted(() => ({
  events: new Map<string, ((event: Record<string, unknown>) => void)[]>(),
  added: [] as { id: string; url: string }[],
  seeks: [] as number[],
  snapshot: null as unknown,
}));

vi.mock('react-native', () => ({
  NativeModules: { TrackPlayerModule: { seekTo: async (seconds: number) => { native.seeks.push(seconds); } } },
  NativeEventEmitter: class { addListener() { return { remove() { return undefined; } }; } },
  DeviceEventEmitter: { addListener() { return { remove() { return undefined; } }; } },
  Platform: { OS: 'ios', Version: 1 },
  PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { POST_NOTIFICATIONS: '' } },
}));
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
    reset: async () => undefined,
    add: async (track: { id: string; url: string }) => { native.added.push(track); },
    skip: async () => undefined,
    seekTo: async (seconds: number) => { native.seeks.push(seconds); },
    setRate: async () => undefined,
    setVolume: async () => undefined,
    play: async () => undefined,
    getProgress: async () => ({ position: 0, duration: 300 }),
  },
  Event: { PlaybackState: 'state', PlaybackError: 'error', PlaybackActiveTrackChanged: 'active' },
  State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading', Error: 'error' },
  AndroidAudioContentType: { Speech: 'speech' }, AppKilledPlaybackBehavior: { ContinuePlayback: 'continue' },
  Capability: { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, SeekTo: 5, JumpForward: 6, JumpBackward: 7 },
  IOSCategory: { Playback: 'playback' }, IOSCategoryMode: { SpokenAudio: 'spoken' },
}));
vi.mock('../content/generation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../content/generation.js')>();
  return { ...original, loadContentSnapshot: async () => native.snapshot as ContentSnapshot };
});
vi.mock('./dataSource.js', () => ({
  getLessonForPlayback: async (id: string) => ({ ...makeValidLesson(), id }),
  markListened: async () => undefined,
  savePlaybackPosition: async () => undefined,
}));
vi.mock('../settings/dailyLearning.js', () => ({ setListenProgressBaseline: vi.fn(), clearListenProgressBaselines: vi.fn() }));

const fs: ContentFs = {
  documentDirectory: 'file:///seek-lesson-race/',
  ensureDirectory: async () => undefined,
  writeFile: async () => undefined,
  moveFile: async () => undefined,
  getFileSize: async () => null,
  readFilePrefixBase64: async () => '',
  readFile: async () => '',
  exists: async () => false,
  listDirectory: async () => [],
};

function raceSnapshot(): ContentSnapshot {
  return {
    root: 'file:///race/',
    generationId: 'RACE',
    pointerSequence: 3,
    modules: null,
    manifest: {
      version: '0.8.0',
      audioBaseUrl: 'https://race.invalid/audio',
      lessons: [],
    },
  } as unknown as ContentSnapshot;
}

const cue = (lessonId: string, blockSeconds: number) => ({
  lessonId,
  blocks: [
    { index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 1, isKeySentence: false, section: 'body' },
    { index: 1, speaker: 'B', startSeconds: blockSeconds, durationSeconds: 1, isKeySentence: false, section: 'body' },
  ],
});

describe('R13-R1 delayed seek after lesson switch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    native.added.length = 0;
    native.seeks.length = 0;
    native.events.clear();
    native.snapshot = raceSnapshot();
    setContentFs(fs);
    clearCueSheetCache();
    usePlayerStore.getState().reset();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const lessonId = url.match(/(M\d{2}-\d{2}-\d{2})\.cues\.json/)?.[1] ?? 'M02-01-01';
      return new Response(JSON.stringify(cue(lessonId, 5)));
    }));
  });

  afterEach(async () => {
    stopPositionTracking();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await clearPlayback();
  });

  async function finishPlay(command: Promise<void>, expectedLessonId: string) {
    await vi.waitFor(() => expect(native.added.at(-1)?.id).toBe(expectedLessonId));
    await vi.advanceTimersByTimeAsync(250);
    await command;
  }

  it('ignores a delayed chapter seek after playLesson selects another lesson (review13 recheck)', async () => {
    await finishPlay(playLesson('M02-01-01'), 'M02-01-01');

    let releaseCue: ((response: Response) => void) | undefined;
    const fetchStarted = vi.fn();
    vi.stubGlobal('fetch', vi.fn(() => {
      fetchStarted();
      return new Promise<Response>((resolve) => { releaseCue = resolve; });
    }));

    const oldSeek = seekToBlock('M02-01-01', 1);
    await vi.waitFor(() => expect(fetchStarted).toHaveBeenCalled());

    await finishPlay(playLesson('M02-01-02'), 'M02-01-02');
    expect(usePlayerStore.getState().queue.items[0]?.lessonId).toBe('M02-01-02');

    const seekCountAfterB = native.seeks.length;
    releaseCue?.(new Response(JSON.stringify(cue('M02-01-01', 37))));
    await oldSeek;

    expect(usePlayerStore.getState().queue.items[0]?.lessonId).toBe('M02-01-02');
    expect(native.seeks).toHaveLength(seekCountAfterB);
  });

  it('still seeks when the current queue item is unchanged', async () => {
    await finishPlay(playLesson('M02-01-01'), 'M02-01-01');

    let releaseCue: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { releaseCue = resolve; })));

    const seek = seekToBlock('M02-01-01', 1);
    await vi.waitFor(() => expect(releaseCue).toBeDefined());
    releaseCue?.(new Response(JSON.stringify(cue('M02-01-01', 42))));
    await seek;

    expect(native.seeks.at(-1)).toBe(42);
  });

  it('ignores a delayed scrub seek after playLesson selects another lesson', async () => {
    await finishPlay(playLesson('M02-01-01'), 'M02-01-01');
    const seekCountBefore = native.seeks.length;

    const oldSeek = seekToSeconds(88);
    await finishPlay(playLesson('M02-01-02'), 'M02-01-02');
    await oldSeek;

    expect(usePlayerStore.getState().queue.items[0]?.lessonId).toBe('M02-01-02');
    expect(native.seeks).toHaveLength(seekCountBefore);
  });
});
