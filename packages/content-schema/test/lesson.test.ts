import { describe, expect, it } from 'vitest';
import { lessonSchema } from '../src/lesson.js';
import { makeValidFaq, makeValidLesson } from './fixtures.js';

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

  it('lehnt einen Sprechblock ohne role ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map(({ role: _role, ...rest }) => rest);
    const result = lessonSchema.safeParse({ ...lesson, speechBlocks });
    expect(result.success).toBe(false);
  });

  it('lehnt eine unbekannte role ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b, i) => (i === 0 ? { ...b, role: 'intro' } : b));
    const result = lessonSchema.safeParse({ ...lesson, speechBlocks });
    expect(result.success).toBe(false);
  });

  it('lehnt eine fehlende faq ab', () => {
    const lesson = makeValidLesson();
    const withoutFaq: Record<string, unknown> = { ...lesson };
    delete withoutFaq['faq'];
    const result = lessonSchema.safeParse(withoutFaq);
    expect(result.success).toBe(false);
  });

  it('lehnt weniger als fünf faq-Einträge ab', () => {
    const lesson = makeValidLesson();
    const result = lessonSchema.safeParse({ ...lesson, faq: makeValidFaq().slice(0, 3) });
    expect(result.success).toBe(false);
  });

  it('lehnt eine faq-Frage ohne Fragezeichen ab', () => {
    const lesson = makeValidLesson();
    const faq = makeValidFaq();
    const firstEntry = faq[0];
    if (firstEntry === undefined) throw new Error('Testfixture faq ist leer');
    faq[0] = { ...firstEntry, question: 'Das ist keine Frage.' };
    const result = lessonSchema.safeParse({ ...lesson, faq });
    expect(result.success).toBe(false);
  });

  it('lehnt eine faq-Antwort mit nur einem Satz ab', () => {
    const lesson = makeValidLesson();
    const faq = makeValidFaq();
    const firstEntry = faq[0];
    if (firstEntry === undefined) throw new Error('Testfixture faq ist leer');
    faq[0] = { ...firstEntry, answer: 'Nur ein einziger Satz.' };
    const result = lessonSchema.safeParse({ ...lesson, faq });
    expect(result.success).toBe(false);
  });
});
