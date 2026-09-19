import { describe, expect, it } from 'vitest';
import { lessonSchema } from '../src/lesson.js';
import { makeValidLesson } from './fixtures.js';

describe('lessonSchema', () => {
  it('akzeptiert eine gültige Lektion', () => {
    const result = lessonSchema.safeParse(makeValidLesson());
    expect(result.success).toBe(true);
  });

  it('lehnt eine falsche Lektionskennung ab', () => {
    const result = lessonSchema.safeParse(makeValidLesson({ id: 'foo' as never }));
    expect(result.success).toBe(false);
  });

  it('lehnt weniger als zehn Quizfragen ab', () => {
    const lesson = makeValidLesson();
    const result = lessonSchema.safeParse({ ...lesson, quiz: lesson.quiz.slice(0, 5) });
    expect(result.success).toBe(false);
  });

  it('lehnt eine Quizfrage mit nicht genau vier Optionen ab', () => {
    const lesson = makeValidLesson();
    const brokenQuiz = lesson.quiz.map((q, i) =>
      i === 0 ? { ...q, options: q.options.slice(0, 3) } : q,
    );
    const result = lessonSchema.safeParse({ ...lesson, quiz: brokenQuiz });
    expect(result.success).toBe(false);
  });

  it('verlangt aiGenerated: true bei Audio', () => {
    const lesson = makeValidLesson();
    const result = lessonSchema.safeParse({
      ...lesson,
      audio: { ...lesson.audio, aiGenerated: false },
    });
    expect(result.success).toBe(false);
  });

  it('lehnt einen ungültigen Portfolio-Baustein ab', () => {
    const lesson = makeValidLesson();
    const result = lessonSchema.safeParse({
      ...lesson,
      practiceTask: { ...lesson.practiceTask, portfolioItem: 'P99' },
    });
    expect(result.success).toBe(false);
  });
});
