import { describe, expect, it } from 'vitest';
import type { Manifest } from '@futuredev/content-schema';
import { buildPublishManifest, diffLessons, lessonStoragePath, manifestChanged, planContentUploads } from '../src/plan.js';

const SUPABASE_URL = 'https://example.supabase.co';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

function manifest(lessons: Manifest['lessons']): Manifest {
  return {
    version: '0.1.0',
    contentBaseUrl: 'https://example.supabase.co/storage/v1/object/public/content',
    audioBaseUrl: 'https://example.supabase.co/storage/v1/object/public/audio',
    lessons,
  };
}

describe('lessonStoragePath', () => {
  it('baut einen unveraenderlichen Pfad aus Lektionskennung und Pruefsummen-Kurzform', () => {
    expect(lessonStoragePath('M01-01-01', SHA_A)).toBe(`lessons/M01-01-01.${SHA_A.slice(0, 12)}.json`);
  });
});

describe('diffLessons', () => {
  it('meldet jede Lektion als neu, wenn es noch kein veroeffentlichtes Manifest gibt', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const uploads = diffLessons(local, null);
    expect(uploads).toEqual([{ id: 'M01-01-01', path: lessonStoragePath('M01-01-01', SHA_A), reason: 'neu' }]);
  });

  it('meldet eine Lektion als geaendert, wenn die Pruefsumme abweicht', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_B, updatedAt: '2026-09-19T00:00:00Z' }]);
    const remote = manifest([{ id: 'M01-01-01', file: 'lessons/M01-01-01.aaaaaaaaaaaa.json', sha256: SHA_A, updatedAt: '2026-09-18T00:00:00Z' }]);
    const uploads = diffLessons(local, remote);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.reason).toBe('geaendert');
  });

  it('meldet nichts, wenn die Pruefsumme gleich bleibt', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const remote = manifest([{ id: 'M01-01-01', file: lessonStoragePath('M01-01-01', SHA_A), sha256: SHA_A, updatedAt: '2026-09-18T00:00:00Z' }]);
    expect(diffLessons(local, remote)).toEqual([]);
  });

  it('laesst unveraenderte Lektionen aus, laedt nur die geaenderte in einer Mehrlektionen-Menge', () => {
    const local = manifest([
      { id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' },
      { id: 'M01-01-02', file: 'M01-01-02.json', sha256: SHA_C, updatedAt: '2026-09-19T00:00:00Z' },
    ]);
    const remote = manifest([
      { id: 'M01-01-01', file: lessonStoragePath('M01-01-01', SHA_A), sha256: SHA_A, updatedAt: '2026-09-18T00:00:00Z' },
      { id: 'M01-01-02', file: lessonStoragePath('M01-01-02', SHA_B), sha256: SHA_B, updatedAt: '2026-09-18T00:00:00Z' },
    ]);
    const uploads = diffLessons(local, remote);
    expect(uploads.map((u) => u.id)).toEqual(['M01-01-02']);
  });
});

describe('buildPublishManifest', () => {
  it('schreibt das Feld file auf den pruefsummenbehafteten Speicherpfad um', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const published = buildPublishManifest(local, SUPABASE_URL);
    expect(published.lessons[0]?.file).toBe(lessonStoragePath('M01-01-01', SHA_A));
    expect(published.version).toBe(local.version);
  });

  it('schreibt contentBaseUrl und audioBaseUrl auf den Supabase-Eimer um, unabhaengig von der lokalen Basis-URL', () => {
    const local = {
      ...manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]),
      contentBaseUrl: 'https://github.com/DomenicMoran/futuredev/releases/download/content-v0.1.0',
      audioBaseUrl: 'https://github.com/DomenicMoran/futuredev/releases/download/audio-v0.1.0',
    };
    const published = buildPublishManifest(local, SUPABASE_URL);
    expect(published.contentBaseUrl).toBe(`${SUPABASE_URL}/storage/v1/object/public/content`);
    expect(published.audioBaseUrl).toBe(`${SUPABASE_URL}/storage/v1/object/public/audio`);
  });

  it('entfernt einen abschliessenden Schraegstrich der uebergebenen Supabase-URL', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const published = buildPublishManifest(local, `${SUPABASE_URL}/`);
    expect(published.contentBaseUrl).toBe(`${SUPABASE_URL}/storage/v1/object/public/content`);
  });
});

describe('manifestChanged', () => {
  it('gilt als geaendert, wenn kein Manifest zuvor veroeffentlicht wurde', () => {
    const local = manifest([]);
    expect(manifestChanged(buildPublishManifest(local, SUPABASE_URL), null)).toBe(true);
  });

  it('gilt als unveraendert, wenn Version, Basis-URLs und Lektionen exakt uebereinstimmen', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const published = buildPublishManifest(local, SUPABASE_URL);
    expect(manifestChanged(published, published)).toBe(false);
  });

  it('gilt als geaendert, wenn sich nur die Version aendert', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const published = buildPublishManifest(local, SUPABASE_URL);
    const remote = { ...published, version: '0.0.9' };
    expect(manifestChanged(published, remote)).toBe(true);
  });
});

describe('planContentUploads (Reihenfolge)', () => {
  it('ordnet alle Lektionsschritte vor den Manifest-Schritt ein', () => {
    const local = manifest([
      { id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' },
      { id: 'M01-01-02', file: 'M01-01-02.json', sha256: SHA_B, updatedAt: '2026-09-19T00:00:00Z' },
    ]);
    const steps = planContentUploads(local, null, SUPABASE_URL);
    expect(steps.at(-1)?.kind).toBe('manifest');
    expect(steps.slice(0, -1).every((step) => step.kind === 'lesson')).toBe(true);
    expect(steps).toHaveLength(3);
  });

  it('enthaelt weiterhin genau den Manifest-Schritt, auch wenn keine Lektion sich geaendert hat', () => {
    const local = manifest([{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const remote = manifest([{ id: 'M01-01-01', file: lessonStoragePath('M01-01-01', SHA_A), sha256: SHA_A, updatedAt: '2026-09-19T00:00:00Z' }]);
    const steps = planContentUploads(local, remote, SUPABASE_URL);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ kind: 'manifest', changed: false });
  });
});
