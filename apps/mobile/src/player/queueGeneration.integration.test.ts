import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentSnapshot } from '../content/generation.js';
import type { ContentFs } from '../content/types.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';
import { clearCueSheetCache, clearPlayback, playLesson, playLessonInModuleContext, seekToBlock, skipToNext, stopPositionTracking } from './index.js';
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
    skipToNext: async () => undefined,
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
  documentDirectory: 'file:///queue-generation-test/',
  ensureDirectory: async () => undefined,
  writeFile: async () => undefined,
  moveFile: async () => undefined,
  getFileSize: async () => null,
  readFilePrefixBase64: async () => '',
  readFile: async () => '',
  exists: async () => false,
  listDirectory: async () => [],
};

function snapshot(name: 'A' | 'B', lessonIds = ['M01-01-01']): ContentSnapshot {
  return {
    root: `file:///${name}/`, generationId: name, pointerSequence: name === 'A' ? 1 : 2, modules: null,
    manifest: {
      version: name === 'A' ? '0.6.0' : '0.7.0',
      audioBaseUrl: `https://${name}.invalid/audio`,
      lessons: lessonIds.map((id) => ({ id, file: `${id}.json` })),
    },
  } as unknown as ContentSnapshot;
}

function cueStartSeconds(url: string): number {
  return url.includes('A.invalid') ? 5 : 50;
}

const cue = (lessonId: string, seconds: number) => ({
  lessonId,
  blocks: [
    { index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 1, isKeySentence: false, section: 'body' },
    { index: 1, speaker: 'B', startSeconds: seconds, durationSeconds: 1, isKeySentence: false, section: 'body' },
  ],
});

describe('queue items retain their content generation for later seeks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    native.added.length = 0;
    native.seeks.length = 0;
    native.events.clear();
    native.snapshot = snapshot('A');
    setContentFs(fs);
    clearCueSheetCache();
    usePlayerStore.getState().reset();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const lessonId = url.match(/(M\d{2}-\d{2}-\d{2})\.cues\.json/)?.[1] ?? 'M01-01-01';
    return new Response(JSON.stringify(cue(lessonId, cueStartSeconds(url))));
  }));
  });

  afterEach(async () => {
    stopPositionTracking();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await clearPlayback();
  });

  async function finishPlay(command: Promise<void>, expectedLessonId?: string) {
    await vi.waitFor(() => expectedLessonId
      ? expect(native.added.at(-1)?.id).toBe(expectedLessonId)
      : expect(native.added.length).toBeGreaterThan(0));
    await vi.advanceTimersByTimeAsync(250);
    await command;
  }

  it('uses generation A cues for a later seek even after B becomes active', async () => {
    const command = playLesson('M01-01-01');
    await finishPlay(command);
    native.snapshot = snapshot('B');
    await seekToBlock('M01-01-01', 1);
    expect(native.added.at(-1)?.url).toContain('A.invalid');
    expect(native.seeks.at(-1)).toBe(5);
  });

  it('keeps each module queue item pinned through a track advance after a pointer swap', async () => {
    native.snapshot = snapshot('A', ['M01-01-01', 'M01-01-02']);
    const command = playLessonInModuleContext('M01-01-01');
    await finishPlay(command);
    expect(native.added.map((track) => track.id)).toEqual(['M01-01-01', 'M01-01-02']);
    native.snapshot = snapshot('B', ['M01-01-01', 'M01-01-02']);
    await skipToNext();
    await seekToBlock('M01-01-02', 1);
    expect(native.added.every((track) => track.url.includes('A.invalid'))).toBe(true);
    expect(native.seeks.at(-1)).toBe(5);
  });

  it('drops a delayed A cue seek after the learner selects B', async () => {
    await finishPlay(playLesson('M01-01-01'), 'M01-01-01');
    let releaseCue: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { releaseCue = resolve; })));
    const seekA = seekToBlock('M01-01-01', 1);
    await vi.waitFor(() => expect(releaseCue).toBeDefined());
    await finishPlay(playLesson('M01-01-02'), 'M01-01-02');
    const seekCountAfterBSelected = native.seeks.length;
    releaseCue?.(new Response(JSON.stringify(cue('M01-01-01', 37))));
    await seekA;
    expect(usePlayerStore.getState().queue.items[usePlayerStore.getState().queue.currentIndex]?.lessonId).toBe('M01-01-02');
    expect(native.seeks).toHaveLength(seekCountAfterBSelected);
  });

  it('drops a delayed seek when a module queue advances to another item', async () => {
    native.snapshot = snapshot('A', ['M01-01-01', 'M01-01-02']);
    await finishPlay(playLessonInModuleContext('M01-01-01'), 'M01-01-02');
    let releaseCue: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { releaseCue = resolve; })));
    const seekA = seekToBlock('M01-01-01', 1);
    await vi.waitFor(() => expect(releaseCue).toBeDefined());
    await skipToNext();
    const seekCountAfterAdvance = native.seeks.length;
    releaseCue?.(new Response(JSON.stringify(cue('M01-01-01', 37))));
    await seekA;
    expect(usePlayerStore.getState().queue.items[usePlayerStore.getState().queue.currentIndex]?.lessonId).toBe('M01-01-02');
    expect(native.seeks).toHaveLength(seekCountAfterAdvance);
  });

  it('lets a newer chapter seek win over a delayed earlier seek for the same track', async () => {
    await finishPlay(playLesson('M01-01-01'), 'M01-01-01');
    let releaseOldCue: ((response: Response) => void) | undefined;
    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      fetchCount += 1;
      if (fetchCount === 1) return new Promise<Response>((resolve) => { releaseOldCue = resolve; });
      return Promise.resolve(new Response(JSON.stringify(cue('M01-01-01', 11))));
    }));
    const oldSeek = seekToBlock('M01-01-01', 1);
    await vi.waitFor(() => expect(releaseOldCue).toBeDefined());
    await seekToBlock('M01-01-01', 1);
    expect(native.seeks.at(-1)).toBe(11);
    const seekCountAfterNewer = native.seeks.length;
    releaseOldCue?.(new Response(JSON.stringify(cue('M01-01-01', 37))));
    await oldSeek;
    expect(native.seeks).toHaveLength(seekCountAfterNewer);
  });
});
