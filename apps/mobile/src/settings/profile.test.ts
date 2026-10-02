import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { markLessonState } from '../data/progress.js';
import { setContentFs } from '../content/contentFs.js';
import type { ContentFs } from '../content/types.js';
import portfolioFile from '../../../../content/portfolio.json';
import careerFile from '../../../../content/career.json';
import { loadProfileData } from './profile.js';

// Fake-Dateisystem mit demselben Manifest wie content/manifest.json (nur
// M01-01-01 veröffentlicht), ohne expo-file-system (Vitest/Node, siehe
// src/content/contentFs.ts).
function emptyContentFs(): ContentFs {
  const documentDirectory = 'memory://';
  return {
    documentDirectory,
    async ensureDirectory() {
      return undefined;
    },
    async writeFile() {
      return undefined;
    },
    async moveFile() { return undefined; },
    async getFileSize() { return null; },
    async readFilePrefixBase64() { return ''; },
    async readFile() {
      throw new Error('nicht gefunden');
    },
    async exists() {
      return false;
    },
    async listDirectory() {
      return [];
    },
  };
}

function fakeContentFs(): ContentFs {
  const store = new Map<string, string>();
  const documentDirectory = 'memory://';
  store.set(
    `${documentDirectory}content/manifest.json`,
    JSON.stringify({
      version: '0.1.0',
      contentBaseUrl: 'https://example.test/content',
      audioBaseUrl: 'https://example.test/audio',
      lessons: [{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: 'a'.repeat(64), updatedAt: '2026-09-19T00:00:00Z' }],
    }),
  );
  return {
    documentDirectory,
    async ensureDirectory() {
      // Kein echtes Dateisystem in Tests: Verzeichnisse existieren implizit.
    },
    async writeFile(path, contents) {
      store.set(path, contents);
    },
    async moveFile(from, to) { const value = store.get(from); if (value !== undefined) { store.set(to, value); store.delete(from); } },
    async getFileSize(path) { return store.has(path) ? new TextEncoder().encode(store.get(path) ?? '').length : null; },
    async readFilePrefixBase64(path) { const value = store.get(path); if (value === undefined) throw new Error('missing'); return btoa(value.slice(0, 8)); },
    async readFile(path) {
      const value = store.get(path);
      if (value === undefined) throw new Error(`nicht gefunden: ${path}`);
      return value;
    },
    async exists(path) {
      return store.has(path);
    },
    async listDirectory() {
      return [];
    },
  };
}

describe('loadProfileData: Jobreife-Anzeige aus progress, exam_results, portfolio_items, career_checklist', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
    setContentFs(fakeContentFs());
  });

  it('zeigt 0 Prozent Jobreife ohne jeden Fortschritt, mit "was noch fehlt" für alle drei Anteile', async () => {
    const data = await loadProfileData();
    expect(data.readiness.percent).toBe(0);
    expect(data.readiness.missing).toHaveLength(3);
    expect(data.portfolio).toHaveLength(portfolioFile.items.length);
    expect(data.career).toHaveLength(careerFile.items.length);
    expect(data.career.every((item) => !item.checked)).toBe(true);
  });

  it('steigt die Jobreife-Anzeige, wenn ein Modul besteht, ein Portfolio-Baustein veröffentlicht und ein Karriere-Punkt abgehakt ist', async () => {
    const db = await getDatabase();
    await db.insertExamResult({ id: 'e1', scope: 'module:M01', score: 90, passed: true, takenAt: '2026-09-19T10:00:00Z' });
    await db.upsertPortfolioItem({ id: 'P00', baustein: 'P00', status: 'veroeffentlicht', url: null, updatedAt: '2026-09-19T10:00:00Z' });
    await db.upsertCareerChecklistItem({ item: 'lebenslauf', checked: true, updatedAt: '2026-09-19T10:00:00Z' });

    const data = await loadProfileData();
    expect(data.readiness.percent).toBeGreaterThan(0);
    expect(data.portfolio.find((p) => p.id === 'P00')?.status).toBe('veroeffentlicht');
    expect(data.career.find((c) => c.id === 'lebenslauf')?.checked).toBe(true);
  });

  it('zeigt den Fortschritt von M01 anhand von progress, sobald die veröffentlichte Lektion abgeschlossen ist', async () => {
    await markLessonState('M01-01-01', 'started');
    const data = await loadProfileData();
    const m01 = data.moduleProgress.find((m) => m.moduleId === 'M01');
    expect(m01?.totalLessons).toBe(1);
    expect(m01?.completedLessons).toBe(0);
    expect(m01?.startedLessons).toBe(1);
  });

  it('zählt Teillese- und Hörfortschritt als Lernaktivität ohne abgeschlossene Lektion', async () => {
    await markLessonState('M01-01-01', 'started', { readUntil: 12 });
    await markLessonState('M01-01-02', 'started', { listenedUntil: 93 });
    const data = await loadProfileData();
    const m01 = data.moduleProgress.find((m) => m.moduleId === 'M01');
    expect(m01?.completedLessons).toBe(0);
    expect(m01?.startedLessons).toBeGreaterThanOrEqual(1);
  });

  it('zählt ein bestandenes Direktquiz als Lernaktivität auch wenn noch kein Lesezustand existiert', async () => {
    await markLessonState('M01-01-01', 'new', { quizPassed: true, quizScore: 100 });
    const data = await loadProfileData();
    const m01 = data.moduleProgress.find((m) => m.moduleId === 'M01');
    expect(m01?.startedLessons).toBe(1);
    expect(m01?.completedLessons).toBe(0);
  });

  it('zählt ein nicht bestandenes Direktquiz (quizScore 0) als begonnene Lektion', async () => {
    await markLessonState('M01-01-01', 'new', { quizPassed: false, quizScore: 0 });
    const data = await loadProfileData();
    const m01 = data.moduleProgress.find((m) => m.moduleId === 'M01');
    expect(m01?.startedLessons).toBe(1);
    expect(m01?.completedLessons).toBe(0);
  });

  it('liefert 10.000 importierte Notizen vollständig für die virtualisierte, durchsuchbare Detailansicht', async () => {
    const db = await getDatabase();
    for (let index = 0; index < 10_000; index += 1) {
      const id = `note-${String(index).padStart(5, '0')}`;
      await db.upsertNote({ id, lessonId: 'M01-01-01', body: index === 9_999 ? 'letzter seltener Suchbegriff' : `Notiz ${index}`, createdAt: '2026-09-25T12:00:00.000Z', updatedAt: '2026-09-25T12:00:00.000Z' });
    }
    const data = await loadProfileData();
    expect(data.notes).toHaveLength(10_000);
    expect(data.notes.some((note) => note.body === 'letzter seltener Suchbegriff')).toBe(true);
    expect(data.notes.some((note) => note.id === 'note-00000')).toBe(true);
  });

  it('zählt completed in M01 auch ohne lokales Manifest (Bundled-Fallback für Lektions-IDs)', async () => {
    setContentFs(emptyContentFs());
    await markLessonState('M01-01-01', 'started');
    await markLessonState('M01-01-01', 'read');
    await markLessonState('M01-01-01', 'quiz_passed', { quizPassed: true, quizScore: 100 });
    await markLessonState('M01-01-01', 'completed');

    const data = await loadProfileData();
    const m01 = data.moduleProgress.find((m) => m.moduleId === 'M01');
    expect(m01?.completedLessons).toBeGreaterThan(0);
  });

  it('persistiert den Portfolio-Status-Zyklus P00 über upsert und loadProfileData (offen → veröffentlicht → erklärt → offen)', async () => {
    const db = await getDatabase();
    const cycle = ['veroeffentlicht', 'erklaert', 'offen'] as const;

    let data = await loadProfileData();
    expect(data.portfolio.find((p) => p.id === 'P00')?.status).toBe('offen');

    for (const expected of cycle) {
      await db.upsertPortfolioItem({
        id: 'P00',
        baustein: 'P00',
        status: expected,
        url: null,
        updatedAt: new Date().toISOString(),
      });
      data = await loadProfileData();
      expect(data.portfolio.find((p) => p.id === 'P00')?.status).toBe(expected);
    }
  });

  it('zählt erklärte Portfolio-Bausteine für die Jobreife wie veröffentlichte', async () => {
    const db = await getDatabase();
    await db.upsertPortfolioItem({
      id: 'P01',
      baustein: 'P01',
      status: 'erklaert',
      url: null,
      updatedAt: new Date().toISOString(),
    });

    const data = await loadProfileData();
    expect(data.portfolio.find((p) => p.id === 'P01')?.status).toBe('erklaert');
    expect(data.readiness.percent).toBeGreaterThan(0);
  });
});
