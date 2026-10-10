import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { getSetting, setSetting } from '../data/settings.js';
import { PLACEMENT_QUESTIONS, assess, parseResult, recommendedLesson, type Answers, type PlacementResult } from './assessment.js';
import { PLACEMENT_KEY, loadPlacement, savePlacement } from './persistence.js';
const answers = (correct: boolean): Answers => Object.fromEntries(PLACEMENT_QUESTIONS.map(q => [q.id, correct ? q.correct : -1]));
const result = (a = answers(true), skipKnown = true): PlacementResult => ({ version: 1, answers: a, skipKnown, completedAt: '2026-10-10T10:00:00Z' });
const modules = [{ subModules: [...new Set(PLACEMENT_QUESTIONS.map(q => q.topic))].map(id => ({ id, lessons: [{ id: `${id}-01`, available: true }] })) }, { subModules: [{ id: 'M02-01', lessons: [{ id: 'M02-01-01', available: true }] }] }];
describe('optional advisory placement', () => {
  beforeEach(() => resetToMemoryDatabase());
  it('covers all seven foundations with two questions each and varied answer positions', () => {
    expect(assess({})).toHaveLength(7);
    expect(assess({}).every(t => t.total === 2)).toBe(true);
    expect(new Set(PLACEMENT_QUESTIONS.map(q => q.correct)).size).toBe(3);
  });
  it('keeps beginners at the beginning', () => {
    expect(assess(answers(false)).every(t => !t.known)).toBe(true);
    expect(recommendedLesson(result(answers(false)), modules)).toBe('M01-00-01');
  });
  it('never averages away a weak topic in a mixed result', () => {
    const a = answers(true); a['M01-02-1'] = -1;
    expect(assess(a).filter(t => !t.known).map(t => t.topic)).toEqual(['M01-02']);
    expect(recommendedLesson(result(a), modules)).toBe('M01-02-01');
  });
  it('allows advanced users to opt into a later entry without claiming completion', () => {
    expect(recommendedLesson(result(), modules)).toBe('M02-01-01');
    expect(recommendedLesson(result(answers(true), false), modules)).toBe('M01-00-01');
    expect(recommendedLesson(null, modules)).toBe('M01-00-01');
  });
  it('never recommends unavailable lessons, handles an exhausted or empty catalog', () => {
    expect(recommendedLesson(result(), modules.slice(0, 1))).toBeNull();
    expect(recommendedLesson(null, [])).toBeNull();
    expect(recommendedLesson(null, [{ subModules: [{ id: 'M01-00', lessons: [{ id: 'missing', available: false }, { id: 'ready', available: true }] }] }])).toBe('ready');
  });
  it('persists across a fresh load and preserves all progress data', async () => {
    const db = await getDatabase();
    const before = await db.listProgress();
    await savePlacement(result());
    expect(await loadPlacement()).toEqual(result());
    expect(await db.listProgress()).toEqual(before);
    await savePlacement({ ...result(), skipKnown: false });
    expect((await loadPlacement())?.skipKnown).toBe(false);
    expect(await db.listProgress()).toEqual(before);
  });
  it('rejects incomplete checks and retains previous results on restart/cancel', async () => {
    await savePlacement(result());
    const stored = await getSetting(PLACEMENT_KEY);
    await expect(savePlacement(result({}))).rejects.toThrow();
    expect(await getSetting(PLACEMENT_KEY)).toBe(stored);
    expect(await loadPlacement()).toEqual(result());
  });
  it('validates stale, malformed, and out-of-range imported settings', async () => {
    for (const raw of ['{', '{}', JSON.stringify({ ...result(), version: 2 }), JSON.stringify({ ...result(), completedAt: 'bad' }), JSON.stringify(result({ ...answers(true), ['M01-00-1']: 99 }))]) {
      expect(parseResult(raw)).toBeNull();
      await setSetting(PLACEMENT_KEY, raw);
      expect(await loadPlacement()).toBeNull();
    }
  });
  it('surfaces storage failures instead of pretending a result was saved', async () => {
    const db = await getDatabase();
    vi.spyOn(db, 'setSetting').mockRejectedValueOnce(new Error('full'));
    await expect(savePlacement(result())).rejects.toThrow('full');
    expect(await loadPlacement()).toBeNull();
  });
});
