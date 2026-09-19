import { describe, expect, it } from 'vitest';
import { drawQuestions, evaluateQuiz, type QuizQuestionInput } from '../src/quiz.js';

function makePool(count: number): QuizQuestionInput[] {
  return Array.from({ length: count }, (_, i) => ({
    question: `Frage ${i}`,
    options: [
      { text: 'richtig', isCorrect: true, explanation: 'weil richtig' },
      { text: 'falsch a', isCorrect: false, explanation: 'weil falsch' },
      { text: 'falsch b', isCorrect: false, explanation: 'weil falsch' },
      { text: 'falsch c', isCorrect: false, explanation: 'weil falsch' },
    ],
  }));
}

describe('drawQuestions', () => {
  it('zieht ohne Wiederholung genau n Fragen', () => {
    const drawn = drawQuestions(makePool(20), 10, 42);
    expect(drawn).toHaveLength(10);
    const questionTexts = new Set(drawn.map((q) => q.question));
    expect(questionTexts.size).toBe(10);
  });

  it('ist bei gleichem Seed deterministisch', () => {
    const a = drawQuestions(makePool(20), 10, 7);
    const b = drawQuestions(makePool(20), 10, 7);
    expect(a).toEqual(b);
  });

  it('mischt die Optionen (nicht immer dieselbe Reihenfolge)', () => {
    const drawn = drawQuestions(makePool(20), 5, 1);
    const firstOptionIsAlwaysCorrect = drawn.every((q) => q.options[0]?.isCorrect);
    expect(firstOptionIsAlwaysCorrect).toBe(false);
  });

  it('wirft, wenn mehr Fragen verlangt werden als vorhanden sind', () => {
    expect(() => drawQuestions(makePool(3), 10, 1)).toThrow();
  });
});

describe('evaluateQuiz', () => {
  it('besteht ab genau 80 Prozent', () => {
    const drawn = drawQuestions(makePool(10), 10, 3);
    const answers = drawn.map((q, i) => {
      const correctIndex = q.options.findIndex((o) => o.isCorrect);
      // 8 von 10 richtig beantworten, 2 bewusst falsch.
      const chosenOptionIndex = i < 8 ? correctIndex : (correctIndex + 1) % 4;
      return { questionIndex: i, chosenOptionIndex };
    });
    const result = evaluateQuiz(drawn, answers);
    expect(result.correctCount).toBe(8);
    expect(result.scorePercent).toBe(80);
    expect(result.passed).toBe(true);
  });

  it('fällt unter 80 Prozent durch, keine Teilpunkte', () => {
    const drawn = drawQuestions(makePool(10), 10, 3);
    const answers = drawn.map((q, i) => {
      const correctIndex = q.options.findIndex((o) => o.isCorrect);
      const chosenOptionIndex = i < 7 ? correctIndex : (correctIndex + 1) % 4;
      return { questionIndex: i, chosenOptionIndex };
    });
    const result = evaluateQuiz(drawn, answers);
    expect(result.scorePercent).toBe(70);
    expect(result.passed).toBe(false);
  });
});
