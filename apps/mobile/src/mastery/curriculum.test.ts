import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase } from '../data/db.js';
import {
  beginHearing,
  clearReviewHearing,
  listReviewHearingProgress,
  recordHearingSample,
  resetHearingBaseline,
} from '../player/hearingProgress.js';
import { answer, begin, emptyState, finish, makeBank, summary } from './engine.js';
import { loadMastery, saveMastery } from './persistence.js';
import { bundledContent, bundledManifest, getBundledLesson } from '../content/bundledData.js';
import { buildModuleList } from '../content/listLessons.js';
function contentBank() {
  const lessons = bundledManifest.lessons.map((entry) => {
    const lesson = getBundledLesson(entry.id);
    if (!lesson) throw new Error(`Missing lesson ${entry.id}`);
    return lesson;
  });
  return makeBank(lessons.flatMap((l) => l.quiz.map((q) => ({ ...q, sourceLessonId: l.id }))));
}
describe('real curriculum and audio-only repetition', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
    resetHearingBaseline();
  });
  it('covers every actual question through the ten module exams and pools their errors', async () => {
    const bank = contentBank();
    const modules = await buildModuleList(bundledContent.modules, bundledManifest);
    const seen = new Set<string>();
    let state = emptyState();
    for (const module of modules) {
      state = begin(state, bank, {
        title: module.title,
        lessonIds: module.subModules.flatMap((s) => s.lessons.map((l) => l.id)),
      });
      for (const key of state.session?.keys ?? []) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        state = answer(state, -1, bank);
      }
      state = finish(state, bank);
    }
    expect(modules).toHaveLength(10);
    expect(seen.size).toBe(2375);
    expect(summary(state, bank).unseen).toBe(0);
    expect(begin(state, bank, 'review').session?.keys).toHaveLength(2375);
  });
  it('draws ALL actual lessons/questions, reaches 100 only with every actual question correct', () => {
    const bank = contentBank();
    expect(bank.length).toBe(2375);
    expect(new Set(bank.map((q) => q.sourceLessonId)).size).toBe(197);
    let s = begin(emptyState(), bank, false, 2);
    expect(new Set(s.session?.keys).size).toBe(bank.length);
    const ordered = s.session?.keys.map((k) => bank.find((q) => q.key === k));
    for (const q of ordered ?? []) {
      if (!q) throw new Error('Missing question');
      s = answer(
        s,
        q.options.findIndex((o) => o.isCorrect),
        bank,
      );
    }
    expect(summary(s, bank).percent).toBe(0);
    expect(summary(finish(s, bank), bank).percent).toBe(100);
  });
  it('counts only hearing AFTER evaluation, not historical listening; seeking never completes review', async () => {
    const bank = contentBank().slice(0, 1);
    const id = bank[0]?.sourceLessonId ?? '';
    beginHearing(id, 0, true, 0);
    await recordHearingSample(id, 20, 20, false, 1, 20000);
    const s = finish(answer(begin(emptyState(), bank), -1, bank), bank);
    await saveMastery(s);
    expect(await listReviewHearingProgress()).toEqual({});
    beginHearing(id, 0, true, 30000);
    await recordHearingSample(id, 20, 20, false, 1, 31000);
    expect(await listReviewHearingProgress()).toEqual({});
    beginHearing(id, 0, true, 40000);
    await recordHearingSample(id, 10, 20, true, 1, 50000);
    await recordHearingSample(id, 20, 20, false, 1, 60000);
    expect((await listReviewHearingProgress())[id]?.completed).toBe(true);
    expect(summary(await loadMastery(), bank).percent).toBe(0);
    await clearReviewHearing(id);
    expect(await listReviewHearingProgress()).toEqual({});
  });
  it('resets audio coverage for each evaluated round and preserves it for preference changes', async () => {
    const bank = contentBank().slice(0, 1);
    const id = bank[0]?.sourceLessonId ?? '';
    const s = finish(answer(begin(emptyState(), bank), -1, bank), bank);
    await saveMastery(s);
    beginHearing(id, 0, true, 0);
    await recordHearingSample(id, 20, 20, false, 1, 20000);
    await saveMastery({ ...s, medium: 'read' });
    expect((await listReviewHearingProgress())[id]?.completed).toBe(true);
    const next = {
      ...s,
      history: [...s.history, { at: '2099-01-01T00:00:00Z', total: 1, correct: 0, remaining: 1 }],
    };
    await saveMastery(next);
    expect(await listReviewHearingProgress()).toEqual({});
  });
  it('does not swallow persistence failures', async () => {
    const db = resetToMemoryDatabase();
    db.setSetting = async () => {
      throw new Error('disk full');
    };
    await expect(saveMastery(emptyState())).rejects.toThrow('disk full');
  });
});
