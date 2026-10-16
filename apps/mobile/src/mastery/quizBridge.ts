import type { Database } from '../data/types.js';
import type { DrawnQuestion, QuizAnswer } from '@futuredev/core';
import { answer, begin, finish, makeBank, parseState } from './engine.js';
import { MASTERY_KEY, writeMastery } from './persistence.js';

/** Same canonical identity, evidence and review queue for lesson, module and daily quizzes. */
export async function recordSharedQuiz(
  tx: Database,
  drawn: DrawnQuestion[],
  answers: QuizAnswer[],
  now: Date,
) {
  if (!answers.length) return;
  const state = parseState(await tx.getSetting(MASTERY_KEY));
  const answered = new Set<number>();
  const bank = makeBank(
    answers.map((a) => {
      const q = drawn[a.questionIndex];
      if (!q || answered.has(a.questionIndex) || !q.options[a.chosenOptionIndex])
        throw new Error('Ungültige Quizantwort.');
      answered.add(a.questionIndex);
      return {
        questionId: q.questionId,
        sourceLessonId: q.sourceLessonId,
        question: q.question,
        options: [...q.options]
          .sort((a, b) => a.index - b.index)
          .map(({ text, explanation, isCorrect }) => ({ text, explanation, isCorrect })),
      };
    }),
  );
  let next = begin({ ...state, session: null }, bank, 'all', 1);
  const choices = new Map(
    answers.map((a) => {
      const q = drawn[a.questionIndex];
      return [
        `${q?.sourceLessonId}/${q?.questionId}`,
        q?.options[a.chosenOptionIndex]?.index ?? -1,
      ];
    }),
  );
  for (const key of next.session?.keys ?? [])
    next = answer(next, choices.get(key.split(':')[0] ?? '') ?? -1, bank);
  next = finish(next, bank, now);
  // This adapter only loaded the answered subset, not the entire curriculum.
  // Never present its remaining count as a whole-course trend.
  next = {
    ...next,
    history: next.history.map((h, i) =>
      i === next.history.length - 1 ? { ...h, remainingScope: 'round' as const } : h,
    ),
  };
  // A paused comprehensive exam is never replaced by a short quiz.
  await writeMastery(tx, { ...next, session: state.session });
}
