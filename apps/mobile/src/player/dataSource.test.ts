// Prueft, dass eine ungueltige Lektion (z. B. weil eine falsche Basis-URL
// eine fremde JSON-Antwort liefert, siehe Pruefbericht Phase 3 B-01) nie als
// unbehandelter ZodError bis zum Aufrufer durchschlaegt, sondern als
// normaler Error mit klarer Meldung, den die Oberflaeche (hoeren.tsx)
// abfangen und als Banner zeigen kann.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { setContentFs } from '../content/contentFs.js';
import { getLessonForPlayback } from './dataSource.js';

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
