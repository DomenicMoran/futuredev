// Prueft, dass eine ungueltige Lektion (z. B. weil eine falsche Basis-URL
// eine fremde JSON-Antwort liefert, siehe Pruefbericht Phase 3 B-01) nie als
// unbehandelter ZodError bis zum Aufrufer durchschlaegt, sondern als
// normaler Error mit klarer Meldung, den die Oberflaeche (hoeren.tsx)
// abfangen und als Banner zeigen kann. Zusaetzlich deckt resolveContentBaseUrl
// den Manifest-Fallback fuer die Basis-URL ab (B-01).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@futuredev/content-schema';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { getLessonForPlayback, resolveContentBaseUrl } from './dataSource.js';
import { digestUtf8 } from '../content/generation.js';
import { getBundledLesson } from '../content/bundledData.js';

function fakeFs(overrides: Partial<ContentFs> = {}): ContentFs {
  return {
    documentDirectory: 'file:///doc/',
    ensureDirectory: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    moveFile: vi.fn(async () => undefined),
    getFileSize: vi.fn(async () => null),
    readFilePrefixBase64: vi.fn(async () => ''),
    readFile: vi.fn(async () => {
      throw new Error('nicht gestellt');
    }),
    exists: vi.fn(async () => false),
    listDirectory: vi.fn(async () => []),
    ...overrides,
  };
}

const lesson = getBundledLesson('M01-00-01');
if (!lesson) throw new Error('Expected bundled lesson fixture');
const remoteRaw = JSON.stringify({ ...lesson, id: 'M01-01-01' });
const publishedLessonEntry = manifest().lessons[0];
if (!publishedLessonEntry) throw new Error('Expected manifest lesson fixture');

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '0.1.0',
    contentBaseUrl: 'https://manifest.example/content',
    audioBaseUrl: 'https://manifest.example/audio',
    lessons: [{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: digestUtf8(remoteRaw), updatedAt: '2026-09-19T00:00:00Z' }],
    ...overrides,
  };
}

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_CONTENT_BASE_URL;

beforeEach(() => {
  process.env.EXPO_PUBLIC_CONTENT_BASE_URL = 'https://example.test/content';
});

afterEach(() => {
  process.env.EXPO_PUBLIC_CONTENT_BASE_URL = ORIGINAL_ENV;
  setContentFs(fakeFs());
  vi.restoreAllMocks();
});

describe('getLessonForPlayback: Manifestgebundener Netz-Fallback', () => {
  function manifestFs(value = manifest()) {
    const files = new Map([[`file:///doc/content/manifest.json`, JSON.stringify(value)]]);
    return fakeFs({
      readFile: vi.fn(async (path: string) => {
        const raw = files.get(path);
        if (raw === undefined) throw new Error('not found');
        return raw;
      }),
      exists: vi.fn(async (path: string) => files.has(path)),
    });
  }

  it('validiert SHA und Schema bevor eine Remotelektion akzeptiert wird', async () => {
    setContentFs(manifestFs());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(remoteRaw, { status: 200 })),
    );

    await expect(getLessonForPlayback('M01-01-01')).resolves.toMatchObject({ id: 'M01-01-01' });
  });

  it('verwirft SHA-Fehler und Lesson-IDs, die nicht zum angefragten Schlüssel passen', async () => {
    setContentFs(manifestFs(manifest({ lessons: [{ ...publishedLessonEntry, sha256: 'a'.repeat(64) }] })));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(remoteRaw, { status: 200 })));
    await expect(getLessonForPlayback('M01-01-01')).rejects.toThrow('SHA-256 mismatch');

    const wrongId = JSON.stringify({ ...lesson, id: 'M01-01-02' });
    setContentFs(manifestFs(manifest({ lessons: [{ ...publishedLessonEntry, sha256: digestUtf8(wrongId) }] })));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(wrongId, { status: 200 })));
    await expect(getLessonForPlayback('M01-01-01')).rejects.toThrow('Lektionskennung stimmt');
  });

  it('verwendet keinen Remote-Fallback für IDs außerhalb des gepinnten Manifests', async () => {
    setContentFs(manifestFs());
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    await expect(getLessonForPlayback('M01-01-02')).rejects.toThrow('nicht veröffentlicht');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('wirft einen klaren Error ohne gesetzte Basis-URL, statt lautlos haengen zu bleiben', async () => {
    process.env.EXPO_PUBLIC_CONTENT_BASE_URL = '';
    setContentFs(manifestFs());

    await expect(getLessonForPlayback('M01-01-01')).rejects.toThrow('keine Inhaltsbasis-URL gesetzt');
  });
});

describe('resolveContentBaseUrl: Manifest-Fallback (B-01)', () => {
  it('bevorzugt die Env-Variable, wenn sie gesetzt ist', () => {
    process.env.EXPO_PUBLIC_CONTENT_BASE_URL = 'https://env.example/content';
    expect(resolveContentBaseUrl(manifest())).toBe('https://env.example/content');
  });

  it('faellt auf die Manifest-URL zurueck, wenn die Env-Variable fehlt', () => {
    delete process.env.EXPO_PUBLIC_CONTENT_BASE_URL;
    expect(resolveContentBaseUrl(manifest())).toBe('https://manifest.example/content');
  });

  it('liefert einen leeren String ohne Manifest und ohne Env-Variable', () => {
    delete process.env.EXPO_PUBLIC_CONTENT_BASE_URL;
    expect(resolveContentBaseUrl(null)).toBe('');
  });
});
