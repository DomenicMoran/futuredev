import { describe, expect, it } from 'vitest';
import { getDatabase, resetToMemoryDatabase } from '../data/db.js';
import { answer, begin, emptyState, finish, makeBank, summary } from './engine.js';
import { loadMastery, saveMastery } from './persistence.js';
import { bundledManifest, getBundledLesson } from '../content/bundledData.js';
import { exportAllFrom, importAllInto } from '../data/exportImport.js';
import { importExportJson } from '../settings/importExport.js';

describe('complete-bank persistence and failure boundaries', () => {
  it('saves all 2375 answers, survives periodic restarts, then schedules every correct question', async () => {
    resetToMemoryDatabase();
    const bank = makeBank(
      bundledManifest.lessons.flatMap((entry) => {
        const lesson = getBundledLesson(entry.id);
        if (!lesson) throw new Error('missing lesson');
        return lesson.quiz.map((q) => ({ ...q, sourceLessonId: lesson.id }));
      }),
    );
    let s = begin(emptyState(), bank);
    await saveMastery(s);
    const byKey = new Map(bank.map((q) => [q.key, q]));
    for (let i = 0; i < bank.length; i++) {
      const q = byKey.get(s.session?.keys[i] ?? '');
      if (!q) throw new Error('missing question');
      const next = answer(
        s,
        q.options.findIndex((o) => o.isCorrect),
        bank,
      );
      await saveMastery(next, s);
      s = next;
      if (i % 100 === 0) s = await loadMastery(bank);
    }
    const completed = finish(s, bank, new Date('2026-10-15T10:00:00Z'));
    await saveMastery(completed, s);
    const actual = await loadMastery(bank);
    expect(summary(actual, bank, new Date('2026-10-15T10:00:00Z'))).toMatchObject({
      percent: 100,
      confirmed: 0,
    });
    expect(summary(actual, bank, new Date('2026-10-16T10:00:00Z')).due).toHaveLength(2375);
    const resumed = begin(actual, bank, 'all');
    await saveMastery(resumed, actual);
    const source = await getDatabase();
    const raw = JSON.stringify(await exportAllFrom(source));
    expect(raw.length).toBeGreaterThan(2_000_000);
    resetToMemoryDatabase();
    await importExportJson(raw);
    expect(await loadMastery(bank)).toEqual(resumed);
    await expect((await getDatabase()).listReviews()).resolves.toHaveLength(2375);
  }, 60000);
  it('does not let an older imported long-interval review erase a recent relapse', async () => {
    const db = resetToMemoryDatabase();
    const old = {
      sourceLessonId: 'M01-00-01',
      questionId: 'q1',
      leitnerStage: 5,
      dueAt: '2026-12-01T00:00:00Z',
      errorCount: 0,
    };
    await db.upsertReview(old);
    const backup = await exportAllFrom(db);
    const current = { ...old, leitnerStage: 1, dueAt: '2026-10-16T00:00:00Z', errorCount: 1 };
    await db.upsertReview(current);
    await importAllInto(db, backup);
    expect(await db.listReviews()).toEqual([current]);
  });
  it('rejects corrupt embedded learning state without importing any unrelated rows', async () => {
    const db = resetToMemoryDatabase();
    const bundle = await exportAllFrom(db);
    bundle.settings.push({ key: 'mastery_v1', value: '{' }, { key: 'unexpected', value: 'yes' });
    await expect(importAllInto(db, bundle)).rejects.toThrow('Lernkreislauf');
    expect(await db.getSetting('unexpected')).toBeUndefined();
  });
  it('repairs damaged local learning state from a valid export without replacing healthy state', async () => {
    const db = resetToMemoryDatabase();
    await saveMastery(emptyState());
    const backup = await exportAllFrom(db);
    await db.setSetting('mastery_v1', '{broken');
    await db.upsertReview({
      sourceLessonId: 'M01-00-01',
      questionId: 'q1',
      leitnerStage: 5,
      dueAt: '2099-01-01T00:00:00Z',
      errorCount: 2,
    });
    await importAllInto(db, backup);
    expect(await loadMastery()).toEqual(emptyState());
    expect(await db.getSetting('damaged_archive.mastery_v1')).toBe('{broken');
    expect((await db.listReviews())[0]?.leitnerStage).toBe(1);
    const current = { ...emptyState(), medium: 'read' as const };
    await saveMastery(current);
    await importAllInto(db, backup);
    expect(await loadMastery()).toEqual(current);
  });
});
