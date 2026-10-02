import { expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { setContentFs } from '../content/contentFs.js';
import { markLessonState } from '../data/progress.js';
import { loadProfileData } from './profile.js';
import { recordQuizRound } from '../quiz/results.js';
import { drawRound, evaluateRound } from '../quiz/roundLogic.js';
import { makeTestPool } from '../quiz/testPool.js';

function emptyContentFs() {
  setContentFs({
    documentDirectory: 'memory://',
    ensureDirectory: async () => undefined,
    writeFile: async () => undefined,
    moveFile: async () => undefined,
    getFileSize: async () => null,
    readFilePrefixBase64: async () => '',
    readFile: async () => {
      throw new Error('missing');
    },
    exists: async () => false,
    listDirectory: async () => [],
  });
}

it('counts a failed direct lesson quiz (score 0) as started activity', async () => {
  resetToMemoryDatabase();
  emptyContentFs();
  const round = drawRound(makeTestPool(10), 10, 1);
  const answers = round.drawn.map((q, i) => ({
    questionIndex: i,
    chosenOptionIndex: q.options.findIndex((o) => !o.isCorrect),
  }));
  await recordQuizRound({
    scope: { type: 'lesson', lessonId: 'M01-01-01' },
    round,
    answers,
    result: evaluateRound(round, answers),
  });
  expect(await (await getDatabase()).getProgress('M01-01-01')).toMatchObject({
    state: 'new',
    quizScore: 0,
    quizPassed: false,
  });
  expect((await loadProfileData()).moduleProgress.find((m) => m.moduleId === 'M01')?.startedLessons).toBe(1);
});

it('counts a passed direct lesson quiz as started activity', async () => {
  resetToMemoryDatabase();
  emptyContentFs();
  await markLessonState('M01-01-01', 'new', { quizPassed: true, quizScore: 100 });
  expect((await loadProfileData()).moduleProgress.find((m) => m.moduleId === 'M01')?.startedLessons).toBe(1);
});

it('leaves an untouched new lesson out of started activity', async () => {
  resetToMemoryDatabase();
  emptyContentFs();
  expect((await loadProfileData()).moduleProgress.find((m) => m.moduleId === 'M01')?.startedLessons).toBe(0);
});

it('counts a module exam attempt as module activity without inventing lesson progress rows', async () => {
  resetToMemoryDatabase();
  emptyContentFs();
  const db = await getDatabase();
  await db.insertExamResult({
    id: 'module-exam-1',
    scope: 'module:M01',
    score: 0,
    passed: false,
    takenAt: '2026-09-25T12:00:00.000Z',
  });
  expect((await loadProfileData()).moduleProgress.find((m) => m.moduleId === 'M01')?.startedLessons).toBe(1);
});
