import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@futuredev/content-schema';
import { diffManifests, hasManifestChanges } from './manifestDiff.js';
import { fetchManifest, FETCH_TIMEOUT_MS } from './fetchManifest.js';
import { ensureBundledContent } from './bundledContent.js';
import type { ContentFs } from './types.js';

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '0.1.0',
    contentBaseUrl: 'https://example.test/content',
    audioBaseUrl: 'https://example.test/audio',
    lessons: [{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: 'a'.repeat(64), updatedAt: '2026-09-19T00:00:00Z' }],
    ...overrides,
  };
}

describe('diffManifests', () => {
  it('laedt alles, wenn noch kein lokales Manifest existiert', () => {
    const remote = manifest();
    expect(diffManifests(null, remote)).toEqual(remote.lessons);
  });

  it('laedt nichts nach, wenn Pruefsummen gleich sind', () => {
    const local = manifest();
    const remote = manifest();
    expect(diffManifests(local, remote)).toEqual([]);
    expect(hasManifestChanges(local, remote)).toBe(false);
  });

  it('laedt nur die Lektion mit geaenderter Pruefsumme', () => {
    const local = manifest();
    const remote = manifest({
      lessons: [
        { id: 'M01-01-01', file: 'M01-01-01.json', sha256: 'b'.repeat(64), updatedAt: '2026-09-20T00:00:00Z' },
        { id: 'M01-01-02', file: 'M01-01-02.json', sha256: 'c'.repeat(64), updatedAt: '2026-09-20T00:00:00Z' },
      ],
    });
    const changed = diffManifests(local, remote);
    expect(changed.map((l) => l.id)).toEqual(['M01-01-01', 'M01-01-02']);
    expect(hasManifestChanges(local, remote)).toBe(true);
  });
});

describe('fetchManifest: Timeout-Verhalten', () => {
  it('meldet "offline", wenn die Anfrage nie antwortet (Timeout statt haengender UI)', async () => {
    vi.useFakeTimers();
    const neverResolves = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const promise = fetchManifest('https://example.test/content', neverResolves as unknown as typeof fetch, 1000);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1000 > 1000 ? 1000 : FETCH_TIMEOUT_MS);
    const result = await promise;
    expect(result.status).toBe('offline');
    vi.useRealTimers();
  });

  it('sendet Cache-Control: no-store und einen Zeit-Query-Parameter (RN ignoriert die cache-Option)', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(manifest()), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await fetchManifest('https://example.test/content', fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\?t=\d+$/);
    expect((init.headers as Record<string, string>)['Cache-Control']).toBe('no-store');
  });

  it('meldet "error" bei ungueltigem Manifest, ohne zu werfen', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ not: 'a manifest' }), { status: 200 }),
    );
    const result = await fetchManifest('https://example.test/content', fetchMock as unknown as typeof fetch);
    expect(result.status).toBe('error');
  });

  it('meldet "error" bei HTTP-Fehlerstatus', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    const result = await fetchManifest('https://example.test/content', fetchMock as unknown as typeof fetch);
    expect(result.status).toBe('error');
  });
});

function createFakeFs(): ContentFs & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    documentDirectory: 'file:///doc/',
    files,
    async ensureDirectory() {
      // Test-Attrappe: Verzeichnisse existieren implizit, nichts zu tun.
    },
    async writeFile(path, contents) {
      files.set(path, contents);
    },
    async readFile(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error(`Datei fehlt: ${path}`);
      return value;
    },
    async exists(path) {
      return files.has(path);
    },
    async listDirectory(path) {
      return [...files.keys()].filter((p) => p.startsWith(path));
    },
  };
}

describe('ensureBundledContent: Erststart mit gebuendelter Kopie', () => {
  const bundled = {
    manifest: manifest(),
    modules: { modules: [] } as never,
    lessons: { 'M01-01-01': { id: 'M01-01-01', title: 'Test' } },
  };

  it('kopiert Manifest, Modulkarte und Lektionen, wenn noch nichts im Dokumentverzeichnis liegt', async () => {
    const fs = createFakeFs();
    const copied = await ensureBundledContent(fs, bundled);
    expect(copied).toBe(true);
    expect(fs.files.has('file:///doc/content/manifest.json')).toBe(true);
    expect(fs.files.has('file:///doc/content/modules.json')).toBe(true);
    expect(fs.files.has('file:///doc/content/lessons/M01-01-01.json')).toBe(true);
  });

  it('kopiert nichts erneut, wenn bereits ein Manifest existiert (kein Ueberschreiben eines frischeren Standes)', async () => {
    const fs = createFakeFs();
    fs.files.set('file:///doc/content/manifest.json', JSON.stringify(manifest({ version: '9.9.9' })));
    const copied = await ensureBundledContent(fs, bundled);
    expect(copied).toBe(false);
    expect(fs.files.get('file:///doc/content/manifest.json')).toContain('9.9.9');
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
