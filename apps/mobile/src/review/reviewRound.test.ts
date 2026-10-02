import { describe, expect, it } from 'vitest';
import type { QuizQuestionInput } from '@futuredev/core';
import { reviewCardKey } from './cards.js';
import { selectReviewQuestionsForCards } from './reviewRound.js';

function q(sourceLessonId: string, questionId: string): QuizQuestionInput {
  return { sourceLessonId, questionId, question: questionId, options: [] };
}

describe('review round identity', () => {
  it('selects exact due questions across lessons rather than choosing entire lessons', () => {
    const pool = [q('M01-01-01', 'q_1'), q('M01-01-01', 'q_2'), q('M02-01-01', 'q_3')];
    const ids = [reviewCardKey('M01-01-01', 'q_2'), reviewCardKey('M02-01-01', 'q_3')];
    const selected = selectReviewQuestionsForCards(pool, ids);
    expect(selected.questions.map((question) => `${question.sourceLessonId}:${question.questionId}`)).toEqual([
      'M01-01-01:q_2', 'M02-01-01:q_3',
    ]);
    expect(selected.missingCardIds).toEqual([]);
  });

  it('reports stale due IDs rather than silently substituting random questions', () => {
    const id = reviewCardKey('M01-01-01', 'q_removed');
    expect(selectReviewQuestionsForCards([q('M01-01-01', 'q_new')], [id])).toEqual({
      questions: [], missingCardIds: [id],
    });
  });
});
