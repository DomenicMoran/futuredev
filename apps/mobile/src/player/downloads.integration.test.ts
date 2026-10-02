import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import type { Lesson } from '@futuredev/content-schema';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { setContentFs } from '../content/contentFs.js';

const harness = vi.hoisted(() => ({
  files: new Map<string, string>(),
  readFailures: new Set<string>(),
  lesson: null as Lesson | null,
  cueText: '',
  status: 200,
  audioPayload: `ID3${'a'.repeat(2048)}`,
  onCancel: null as (() => void) | null,
  downloadedCount: 0,
  holdDownload: false,
  pendingResolve: null as ((result: { status: number; uri: string }) => void) | null,
  failCueMove: false,
  holdMarkerMove: false,
  markerMoveStarted: null as (() => void) | null,
  releaseMarkerMove: null as (() => void) | null,
  holdValidationRead: false,
  validationReadStarted: null as (() => void) | null,
  releaseValidationRead: null as (() => void) | null,
  holdListDirectoryRead: false,
  listDirectoryReadStarted: null as (() => void) | null,
  releaseListDirectoryRead: null as (() => void) | null,
  ensureCallCount: 0,
  failEnsureOnce: false,
  holdFirstEnsure: false,
  firstEnsureStarted: null as (() => void) | null,
  releaseFirstEnsure: null as (() => void) | null,
}));

vi.mock('./dataSource.js', () => ({
  getLessonForPlayback: async () => harness.lesson,
  markListened: async () => undefined,
  savePlaybackPosition: async () => undefined,
}));
vi.mock('expo-file-system/legacy', () => ({
  deleteAsync: async (path: string) => { harness.files.delete(path); },
  createDownloadResumable: (_url: string, path: string) => ({
    downloadAsync: async () => {
      harness.downloadedCount += 1;
      const result = await new Promise<{ status: number; uri: string }>((resolve, reject) => {
        harness.onCancel = () => reject(new Error('aborted'));
        harness.pendingResolve = resolve;
        if (!harness.holdDownload) queueMicrotask(() => {
          harness.files.set(path, harness.audioPayload);
          resolve({ status: harness.status, uri: path });
        });
      });
      return result;
    },
    cancelAsync: async () => { harness.onCancel?.(); },
  }),
}));

import { cancelDownload, downloadLesson, getValidatedLocalAudioPath, isDownloaded } from './index.js';
import { downloadDirPath } from './downloads.js';
import { checksumCueText } from './downloadValidation.js';
import { usePlayerStore } from './store.js';

const testLesson = makeValidLesson();

function cueTextFor(lesson: Lesson): string {
  return JSON.stringify({ lessonId: lesson.id, blocks: lesson.speechBlocks.map((block, index) => ({
    index, speaker: block.speaker, startSeconds: index * 10, durationSeconds: 9, isKeySentence: block.isKeySentence,
  })) });
}

function fakeFs(): ContentFs {
  return {
    documentDirectory: 'file:///docs/',
    ensureDirectory: async () => {
      harness.ensureCallCount += 1;
      if (harness.ensureCallCount === 1 && harness.holdFirstEnsure) {
        harness.firstEnsureStarted?.();
        await new Promise<void>((resolve) => { harness.releaseFirstEnsure = resolve; });
      }
      if (harness.ensureCallCount === 1 && harness.failEnsureOnce) {
        harness.failEnsureOnce = false;
        throw new Error('directory setup failed');
      }
    },
    writeFile: async (path, text) => { harness.files.set(path, text); },
    readFile: async (path) => {
      if (harness.holdValidationRead && path.endsWith('.cues.json') && !path.includes('.partial.')) {
        harness.validationReadStarted?.();
        await new Promise<void>((resolve) => { harness.releaseValidationRead = resolve; });
      }
      if (harness.readFailures.has(path)) throw new Error('transient native IO failure');
      const value = harness.files.get(path); if (value === undefined) throw new Error('missing'); return value;
    },
    moveFile: async (from, to) => {
      if (harness.failCueMove && to.endsWith('.cues.json')) throw new Error('move failed');
      if (harness.holdMarkerMove && to.endsWith('.download.json') && !to.includes('.partial.')) {
        harness.markerMoveStarted?.();
        await new Promise<void>((resolve) => { harness.releaseMarkerMove = resolve; });
      }
      const value = harness.files.get(from); if (value === undefined) throw new Error('missing'); harness.files.set(to, value); harness.files.delete(from);
    },
    getFileSize: async (path) => { const value = harness.files.get(path); return value === undefined ? null : new TextEncoder().encode(value).length; },
    readFilePrefixBase64: async (path, bytes) => { const value = harness.files.get(path); if (value === undefined) throw new Error('missing'); return btoa(value.slice(0, bytes)); },
    exists: async (path) => harness.files.has(path),
    listDirectory: async (path) => {
      const snapshot = [...harness.files.keys()].filter((name) => name.startsWith(path)).map((name) => name.slice(path.length));
      const audioDir = downloadDirPath('file:///docs/');
      if (harness.holdListDirectoryRead && path === audioDir) {
        // Defer exactly cancel reconciliation's download-dir listing; content snapshot reads proceed.
        harness.holdListDirectoryRead = false;
        harness.listDirectoryReadStarted?.();
        await new Promise<void>((resolve) => { harness.releaseListDirectoryRead = resolve; });
      }
      return snapshot;
    },
  };
}

describe('downloadLesson publication contract', () => {
  beforeEach(() => {
    harness.files.clear();
    harness.readFailures.clear();
    harness.lesson = testLesson;
    harness.cueText = cueTextFor(harness.lesson);
    harness.status = 200;
    harness.audioPayload = `ID3${'a'.repeat(2048)}`;
    harness.onCancel = null;
    harness.downloadedCount = 0;
    harness.holdDownload = false;
    harness.pendingResolve = null;
    harness.failCueMove = false;
    harness.holdMarkerMove = false; harness.markerMoveStarted = null; harness.releaseMarkerMove = null;
    harness.holdValidationRead = false; harness.validationReadStarted = null; harness.releaseValidationRead = null;
    harness.holdListDirectoryRead = false; harness.listDirectoryReadStarted = null; harness.releaseListDirectoryRead = null;
    harness.ensureCallCount = 0; harness.failEnsureOnce = false; harness.holdFirstEnsure = false;
    harness.firstEnsureStarted = null; harness.releaseFirstEnsure = null;
    setContentFs(fakeFs());
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://media.test';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => harness.cueText })));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL; });

  it('publishes a complete validated package and deduplicates repeated requests', async () => {
    const first = downloadLesson(testLesson.id);
    const second = downloadLesson(testLesson.id);
    expect(await first).toBe('downloaded');
    expect(await second).toBe('downloaded');
    expect(harness.downloadedCount).toBe(1);
    expect(await isDownloaded(testLesson.id)).toBe(true);
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('downloaded');
  });

  it('releases task ownership after setup failure so the next retry can succeed', async () => {
    harness.failEnsureOnce = true;
    await expect(downloadLesson(testLesson.id)).rejects.toThrow('directory setup failed');
    await expect(downloadLesson(testLesson.id)).resolves.toBe('downloaded');
    expect(harness.downloadedCount).toBe(1);
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('downloaded');
  });

  it('does not let a cancelled delayed setup overwrite a completed retry', async () => {
    harness.holdFirstEnsure = true;
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    harness.firstEnsureStarted = signalStarted;
    const first = downloadLesson(testLesson.id);
    await started;

    const cancelling = cancelDownload(testLesson.id);
    const retry = downloadLesson(testLesson.id);
    await expect(retry).resolves.toBe('downloaded');

    const release = harness.releaseFirstEnsure;
    if (!release) throw new Error('Initial ensureDirectory was not deferred');
    release();
    await expect(first).resolves.toBe('cancelled');
    await cancelling;
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('downloaded');
    expect(await isDownloaded(testLesson.id)).toBe(true);
  });

  it.each([404, 500])('rejects HTTP %i without exposing partial files', async (status) => {
    harness.status = status;
    await expect(downloadLesson(testLesson.id)).rejects.toThrow(`HTTP ${status}`);
    expect(await isDownloaded(testLesson.id)).toBe(false);
    expect([...harness.files.keys()].some((key) => key.includes('.partial.'))).toBe(false);
  });

  it.each(['', '<html>404</html>'])('rejects empty or non-MP3 response %s', async (content) => {
    harness.audioPayload = content;
    await expect(downloadLesson(testLesson.id)).rejects.toThrow();
    expect(await isDownloaded(testLesson.id)).toBe(false);
  });

  it('rejects malformed or mismatched cues before audio transfer', async () => {
    harness.cueText = JSON.stringify({ lessonId: 'M02-01-01', blocks: [] });
    await expect(downloadLesson(testLesson.id)).rejects.toThrow();
    expect(harness.downloadedCount).toBe(0);
    expect(await isDownloaded(testLesson.id)).toBe(false);
  });

  it('validates legacy flat downloads before accepting them for offline use', async () => {
    harness.files.set(`file:///docs/audio/${testLesson.id}.mp3`, `ID3${'a'.repeat(2048)}`);
    harness.files.set(`file:///docs/audio/${testLesson.id}.cues.json`, harness.cueText);
    expect(await isDownloaded(testLesson.id)).toBe(true);
    harness.files.set(`file:///docs/audio/${testLesson.id}.cues.json`, JSON.stringify({ lessonId: 'M02-01-01', blocks: [] }));
    expect(await isDownloaded(testLesson.id)).toBe(false);
  });

  it('cancels explicitly and leaves a previous valid package intact on failed retry', async () => {
    await expect(downloadLesson(testLesson.id)).resolves.toBe('downloaded');
    const originalMarkers = [...harness.files.keys()].filter((key) => key.endsWith('.download.json'));
    harness.status = 404;
    await expect(downloadLesson(testLesson.id)).rejects.toThrow('HTTP 404');
    expect(await isDownloaded(testLesson.id)).toBe(true);
    expect(originalMarkers.every((marker) => harness.files.has(marker))).toBe(true);
  });

  it('keeps the previous complete generation if publication fails after a partial move', async () => {
    await expect(downloadLesson(testLesson.id)).resolves.toBe('downloaded');
    const originalMarkers = [...harness.files.keys()].filter((key) => key.endsWith('.download.json'));
    harness.failCueMove = true;
    await expect(downloadLesson(testLesson.id)).rejects.toThrow('move failed');
    expect(await isDownloaded(testLesson.id)).toBe(true);
    expect(originalMarkers.every((marker) => harness.files.has(marker))).toBe(true);
    expect([...harness.files.keys()].some((key) => key.includes('.partial.'))).toBe(false);
  });

  it('falls back to the older complete offline generation when a newer marker or its cue read throws', async () => {
    await expect(downloadLesson(testLesson.id)).resolves.toBe('downloaded');
    const oldMarkerPath = [...harness.files.keys()].find((key) => key.endsWith('.download.json'));
    if (!oldMarkerPath) throw new Error('Expected first valid package marker');
    const oldMarker = JSON.parse(harness.files.get(oldMarkerPath) ?? '{}') as { audioFile: string };
    const expectedOldAudio = `file:///docs/audio/${oldMarker.audioFile}`;
    const newest = 'ffffffffffffffffffffffffffffffff';
    const markerPath = `file:///docs/audio/${testLesson.id}.${newest}.download.json`;
    const cuePath = `file:///docs/audio/${testLesson.id}.${newest}.cues.json`;
    harness.files.set(markerPath, JSON.stringify({
      version: 1, lessonId: testLesson.id, generation: newest,
      audioFile: `${testLesson.id}.${newest}.mp3`, audioBytes: 2048, audioPrefix: btoa('ID3' + 'a'.repeat(61)),
      cuesFile: `${testLesson.id}.${newest}.cues.json`, cuesBytes: new TextEncoder().encode(harness.cueText).length,
      cuesChecksum: checksumCueText(harness.cueText),
    }));
    harness.files.set(`file:///docs/audio/${testLesson.id}.${newest}.mp3`, harness.audioPayload);
    harness.files.set(cuePath, harness.cueText);
    harness.readFailures.add(cuePath);
    expect(await isDownloaded(testLesson.id)).toBe(true);
    await expect(getValidatedLocalAudioPath(testLesson.id)).resolves.toBe(expectedOldAudio);
    harness.readFailures.delete(cuePath);
    harness.readFailures.add(markerPath);
    expect(await isDownloaded(testLesson.id)).toBe(true);
    await expect(getValidatedLocalAudioPath(testLesson.id)).resolves.toBe(expectedOldAudio);
  });

  it('reports cancellation as cancelled rather than as a successful download', async () => {
    harness.holdDownload = true;
    const task = downloadLesson(testLesson.id);
    await vi.waitFor(() => expect(harness.onCancel).not.toBeNull());
    await cancelDownload(testLesson.id);
    await expect(task).resolves.toBe('cancelled');
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('not-downloaded');
    expect(await isDownloaded(testLesson.id)).toBe(false);
  });

  it('removes a just-published generation if cancellation lands while marker publication is pending', async () => {
    harness.holdMarkerMove = true;
    let started!: () => void;
    const markerStarted = new Promise<void>((resolve) => { started = resolve; });
    harness.markerMoveStarted = started;
    const task = downloadLesson(testLesson.id);
    await markerStarted;
    const cancelling = cancelDownload(testLesson.id);
    const release = harness.releaseMarkerMove;
    if (!release) throw new Error('Marker move was not deferred');
    release();
    await expect(task).resolves.toBe('cancelled');
    await cancelling;
    expect([...harness.files.keys()].some((key) => key.endsWith('.download.json'))).toBe(false);
    expect(await isDownloaded(testLesson.id)).toBe(false);
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('not-downloaded');
  });

  it('removes a newly published package if cancel arrives during final validation, and never lets old cancel overwrite retry state', async () => {
    harness.holdValidationRead = true;
    let started!: () => void;
    const validationStarted = new Promise<void>((resolve) => { started = resolve; });
    harness.validationReadStarted = started;
    const cancelledTask = downloadLesson(testLesson.id);
    await validationStarted;
    const cancelling = cancelDownload(testLesson.id);
    harness.holdValidationRead = false;
    const retry = downloadLesson(testLesson.id);
    await expect(retry).resolves.toBe('downloaded');
    const release = harness.releaseValidationRead;
    if (!release) throw new Error('Validation read was not deferred');
    release();
    await expect(cancelledTask).resolves.toBe('cancelled');
    await cancelling;
    expect(await isDownloaded(testLesson.id)).toBe(true);
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('downloaded');
  });

  it.each(['active', 'completed'] as const)('does not let old cancellation reconciliation overwrite a %s retry', async (retryState) => {
    harness.holdValidationRead = true;
    let validationStart!: () => void;
    const validationStarted = new Promise<void>((resolve) => { validationStart = resolve; });
    harness.validationReadStarted = validationStart;
    const first = downloadLesson(testLesson.id);
    await validationStarted;

    harness.holdListDirectoryRead = true;
    let listReadStart!: () => void;
    const listReadStarted = new Promise<void>((resolve) => { listReadStart = resolve; });
    harness.listDirectoryReadStarted = listReadStart;
    const cancelling = cancelDownload(testLesson.id);
    const releaseOldValidation = harness.releaseValidationRead;
    if (!releaseOldValidation) throw new Error('First final validation was not deferred');
    harness.holdValidationRead = false;
    releaseOldValidation();
    await listReadStarted; // cancel has snapshotted the old, empty directory

    harness.holdDownload = retryState === 'active';
    const retry = downloadLesson(testLesson.id);
    if (retryState === 'completed') await expect(retry).resolves.toBe('downloaded');
    else await vi.waitFor(() => expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe('downloading'));

    const releaseOldDirectoryRead = harness.releaseListDirectoryRead;
    if (!releaseOldDirectoryRead) throw new Error('Cancel reconciliation read was not deferred');
    harness.holdListDirectoryRead = false;
    releaseOldDirectoryRead();
    await cancelling;
    expect(usePlayerStore.getState().downloads[testLesson.id]?.status).toBe(retryState === 'active' ? 'downloading' : 'downloaded');
    if (retryState === 'completed') expect(await isDownloaded(testLesson.id)).toBe(true);

    if (retryState === 'active') {
      await cancelDownload(testLesson.id);
      await expect(retry).resolves.toBe('cancelled');
    }
    await expect(first).resolves.toBe('cancelled');
  }, 5_000);
});

