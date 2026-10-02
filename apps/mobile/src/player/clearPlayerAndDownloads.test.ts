import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { digestUtf8 } from '../content/generation.js';
import { clearPlayerAndDownloads, downloadLesson } from './index.js';
import { usePlayerStore } from './store.js';

const nativeFs = vi.hoisted(() => ({ deleteAsync: vi.fn(async () => undefined) }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: nativeFs.deleteAsync, createDownloadResumable: vi.fn() }));

describe('clearPlayerAndDownloads action', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('aborts an in-flight cue fetch, waits for it, removes audio cache and resets store without a late file write', async () => {
    const writes: string[] = [];
    const lesson = makeValidLesson();
    const rawLesson = JSON.stringify(lesson);
    const rawManifest = JSON.stringify({
      version: '0.6.0', contentBaseUrl: 'https://example.invalid/content', audioBaseUrl: 'https://example.invalid/audio',
      lessons: [{ id: lesson.id, file: `${lesson.id}.json`, sha256: digestUtf8(rawLesson), updatedAt: '2026-09-25T00:00:00Z' }],
    });
    const fs: ContentFs = {
      documentDirectory: 'file:///docs/',
      ensureDirectory: async () => undefined,
      writeFile: async (path) => { writes.push(path); },
      moveFile: async () => undefined,
      getFileSize: async () => null,
      readFilePrefixBase64: async () => '',
      readFile: async (path) => {
        if (path.endsWith('/content/manifest.json')) return rawManifest;
        throw new Error('not found');
      },
      exists: async (path) => path.endsWith('/content/manifest.json'),
      listDirectory: async () => [],
    };
    setContentFs(fs);
    usePlayerStore.getState().setDownloadState({ lessonId: 'M01-01-01', status: 'not-downloaded', progress: 0, bytesTotal: null });
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://example.invalid/audio';
    process.env.EXPO_PUBLIC_CONTENT_BASE_URL = 'https://example.invalid/content';
    const fetchMock = vi.fn((url: string, init?: RequestInit) => url.includes('/lessons/')
      ? Promise.resolve(new Response(rawLesson, { status: 200 }))
      : new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }));
    vi.stubGlobal('fetch', fetchMock);
    const download = downloadLesson('M01-01-01');
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('.cues.json'))).toBe(true));
    const resetLease = clearPlayerAndDownloads();
    await resetLease.ready;
    resetLease.release();
    await expect(download).resolves.toBe('cancelled');
    expect(writes).toEqual([]);
    expect(nativeFs.deleteAsync).toHaveBeenCalledWith('file:///docs/audio/', { idempotent: true });
    expect(usePlayerStore.getState().downloads).toEqual({});
    delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
    delete process.env.EXPO_PUBLIC_CONTENT_BASE_URL;
  });
});
