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

function fakeFs(overrides: Partial<ContentFs> = {}): ContentFs {
  return {
    documentDirectory: 'file:///doc/',
    ensureDirectory: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    readFile: vi.fn(async () => {
      throw new Error('nicht gestellt');
    }),
    exists: vi.fn(async () => false),
    listDirectory: vi.fn(async () => []),
    ...overrides,
  };
}

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '0.1.0',
    contentBaseUrl: 'https://manifest.example/content',
    audioBaseUrl: 'https://manifest.example/audio',
    lessons: [{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: 'a'.repeat(64), updatedAt: '2026-09-19T00:00:00Z' }],
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

describe('getLessonForPlayback: Fehlerbehandlung', () => {
  it('wirft einen normalen Error statt eines ZodError, wenn die Netz-Antwort nicht dem Lektionsschema entspricht', async () => {
    setContentFs(fakeFs({ exists: vi.fn(async () => false) }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ nicht: 'eine Lektion' }), { status: 200 })),
    );

    await expect(getLessonForPlayback('M01-01-01')).rejects.toThrow(
      'M01-01-01 entspricht nicht dem Lektionsschema',
    );
  });

  it('wirft einen klaren Error ohne gesetzte Basis-URL, statt lautlos haengen zu bleiben', async () => {
    process.env.EXPO_PUBLIC_CONTENT_BASE_URL = '';
    setContentFs(fakeFs({ exists: vi.fn(async () => false) }));

    await expect(getLessonForPlayback('M01-01-01')).rejects.toThrow('EXPO_PUBLIC_CONTENT_BASE_URL ist nicht gesetzt');
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
