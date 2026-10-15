/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test fixtures are statically nonempty. */
import { describe, expect, it } from 'vitest';
import { answer, begin, emptyState, finish, makeBank, parseState, summary } from './engine.js';
import { setDatabase } from '../data/db.js';
import { createMemoryDatabase } from '../data/memoryDatabase.js';
import { loadMastery, saveMastery } from './persistence.js';
import { saveReviewPlaylist } from './playlist.js';
import { exportAllFrom, importAllInto } from '../data/exportImport.js';
import type { QuizQuestionInput } from '@futuredev/core';
const q = (id: string, lesson = 'M01-01-01'): QuizQuestionInput => ({
  questionId: id,
  sourceLessonId: lesson,
  question: `Frage ${id}`,
  options: [
    { text: 'ja', isCorrect: true, explanation: 'darum' },
    { text: 'nein', isCorrect: false, explanation: 'falsch' },
  ],
});
const bank = makeBank([q('1'), q('2'), q('3', 'M02-01-01')]);
describe('mastery learning cycle', () => {
  it('covers every question exactly once and reproducibly shuffles options', () => {
    const s = begin(emptyState(), bank, false, 12).session!;
    expect(new Set(s.keys)).toEqual(new Set(bank.map((q) => q.key)));
    expect(s.orders.every((o) => new Set(o).size === 2)).toBe(true);
    expect(begin(emptyState(), bank, false, 12).session?.keys).toEqual(s.keys);
    expect(summary(emptyState(), bank)).toMatchObject({ percent: 0, unseen: 3 });
  });
  it('shrinks only through correct answers, never hearing or review checkmarks', () => {
    let s = begin(emptyState(), bank, false, 12);
    const first = s.session!.keys[0]!;
    s = answer(s, 0, bank);
    s = answer(s, -1, bank);
    s = answer(s, 1, bank);
    s = finish(s, bank);
    expect(summary(s, bank)).toMatchObject({ passed: 1, remaining: 2, unseen: 0, percent: 33 });
    s.reviewed = ['M01-01-01', 'M02-01-01'];
    s = begin(s, bank, false, 34);
    expect(s.session!.keys).not.toContain(first);
    s = finish(answer(answer(s, 0, bank), 0, bank), bank);
    expect(summary(s, bank)).toMatchObject({ passed: 3, remaining: 0, percent: 100 });
    expect(s.reviewed).toEqual([]);
    expect(() => begin(s, bank)).toThrow();
    s = begin(s, bank, true, 5);
    s = finish(answer(s, 1, bank), bank);
    expect(summary(s, bank).remaining).toBe(1);
  });
  it('partial evaluation retains unseen content and never awards an unanswered question', () => {
    const s = finish(answer(begin(emptyState(), bank), 0, bank), bank);
    expect(summary(s, bank)).toMatchObject({ passed: 1, unseen: 2, remaining: 2 });
    expect(begin(s, bank).session?.keys).toHaveLength(2);
    expect(() => finish(begin(emptyState(), bank), bank)).toThrow();
  });
  it('invalidates changed wording/solutions and additions, not unchanged questions', () => {
    let s = begin(emptyState(), bank);
    bank.forEach(() => {
      s = answer(s, 0, bank);
    });
    s = finish(s, bank);
    const changed = makeBank([
      q('1'),
      { ...q('2'), question: 'Neue Frage' },
      q('3', 'M02-01-01'),
      q('4'),
    ]);
    expect(summary(s, changed)).toMatchObject({ passed: 2, unseen: 2, percent: 50 });
  });
  it('does not grade stale answers against updated content', () => {
    const s = answer(begin(emptyState(), [bank[0]!]), 0, [bank[0]!]);
    const changed = makeBank([{ ...q('1'), question: 'anders' }]);
    expect(summary(finish(s, changed), changed)).toMatchObject({ passed: 0, unseen: 1 });
    expect(() => answer(s, 0, changed)).toThrow();
  });
  it('validates choices and prevents overlapping rounds', () => {
    const s = begin(emptyState(), bank);
    for (const bad of [-2, 2, NaN, 0.5]) expect(() => answer(s, bad, bank)).toThrow();
    expect(() => begin(s, bank)).toThrow();
    expect(() => makeBank([q('1'), q('1')])).toThrow();
    expect(() => makeBank([{ ...q('1'), options: [] }])).toThrow();
  });
  it('round-trips paused rounds, preferences and history without guessing from malformed saves', () => {
    const s = answer(begin({ ...emptyState(), medium: 'mixed' }, bank), -1, bank);
    expect(parseState(JSON.stringify(s))).toEqual(s);
    for (const raw of [
      'null',
      '{}',
      '{',
      JSON.stringify({ ...s, medium: 'other' }),
      JSON.stringify({ ...s, results: { a: 1 } }),
      JSON.stringify({ ...s, session: { ...s.session, answers: [4] } }),
      JSON.stringify({ ...s, session: { ...s.session, orders: [[0, 0]] } }),
    ])
      expect(() => parseState(raw)).toThrow();
  });
  it('empty content cannot become 100 percent', () =>
    expect(summary(emptyState(), []).percent).toBe(0));
  it('saves each submitted answer and survives export/import to a new installation', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    const s = answer(begin(emptyState(), bank), -1, bank);
    await saveMastery(s);
    expect(await loadMastery()).toEqual(s);
    const bundle = await exportAllFrom(db);
    const restored = createMemoryDatabase();
    await importAllInto(restored, bundle);
    setDatabase(restored);
    expect(await loadMastery()).toEqual(s);
  });
  it('reuses an atomic review playlist while preserving personal lists', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    const personal = await db.createPlaylist('Meine');
    await db.addPlaylistItem(personal.id, 'privat');
    const first = await saveReviewPlaylist(['a', 'b', 'a']);
    expect((await db.listPlaylistItems(first)).map((x) => x.lessonId)).toEqual(['a', 'b']);
    expect(await saveReviewPlaylist(['c'])).toBe(first);
    expect((await db.listPlaylistItems(first)).map((x) => x.lessonId)).toEqual(['c']);
    expect((await db.listPlaylistItems(personal.id)).map((x) => x.lessonId)).toEqual(['privat']);
    await db.deletePlaylist(first);
    const recreated = await saveReviewPlaylist(['d']);
    expect((await db.listPlaylistItems(recreated)).map((x) => x.lessonId)).toEqual(['d']);
    await expect(saveReviewPlaylist([])).rejects.toThrow();
  });
});
