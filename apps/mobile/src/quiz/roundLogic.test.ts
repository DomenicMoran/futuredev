import { describe, expect, it } from 'vitest';
import {
  ALL_EXAM_QUESTION_COUNT,
  MIN_ROUND_QUESTION_COUNT,
  MODULE_EXAM_QUESTION_COUNT,
  collectWrongAnswers,
  drawRound,
  evaluateRound,
  questionCountForScope,
  scopeKey,
} from './roundLogic.js';
import { makeTestPool as makePool, must } from './testPool.js';

describe('drawRound', () => {
  it('zieht die gewünschte Anzahl, wenn genug Fragen vorhanden sind', () => {
    const round = drawRound(makePool(20), 10, 1);
    expect(round.drawn).toHaveLength(10);
  });

  it('zieht alle Fragen, wenn der Pool kleiner ist als die gewünschte Anzahl (kleine Lektion)', () => {
    const round = drawRound(makePool(5), 10, 1);
    expect(round.drawn).toHaveLength(5);
  });

  it('liefert bei gleichem Seed dieselbe Ziehung', () => {
    const a = drawRound(makePool(20), 10, 42);
    const b = drawRound(makePool(20), 10, 42);
    expect(a.drawn.map((q) => q.question)).toEqual(b.drawn.map((q) => q.question));
  });
});

describe('evaluateRound und collectWrongAnswers', () => {
  it('bestanden ab 80 Prozent, keine Teilpunkte', () => {
    const round = drawRound(makePool(10), 10, 1);
    const correctIndex = (q: number) => must(round.drawn[q]).options.findIndex((o) => o.isCorrect);
    const answers = round.drawn.map((_, i) => ({ questionIndex: i, chosenOptionIndex: i < 8 ? correctIndex(i) : 0 }));
    const result = evaluateRound(round, answers);
    expect(result.correctCount).toBeGreaterThanOrEqual(8);
    expect(result.passed).toBe(result.scorePercent >= 80);
  });

  it('sammelt falsch beantwortete Fragen mit Begründung der gewählten und der richtigen Option', () => {
    const round = drawRound(makePool(1), 1, 1);
    const question = must(round.drawn[0]);
    const wrongOptionIndex = question.options.findIndex((o) => !o.isCorrect);
    const wrong = collectWrongAnswers(round, [{ questionIndex: 0, chosenOptionIndex: wrongOptionIndex }]);
    expect(wrong).toHaveLength(1);
    expect(must(wrong[0]).chosenExplanation).toBe(must(question.options[wrongOptionIndex]).explanation);
    expect(must(wrong[0]).correctText).toBe(must(question.options.find((o) => o.isCorrect)).text);
  });
});

describe('questionCountForScope', () => {
  it('Lektion: mindestens zehn Fragen, sonst die eingestellte Quizlänge', () => {
    expect(questionCountForScope({ type: 'lesson', lessonId: 'M01-01-01' }, 5)).toBe(MIN_ROUND_QUESTION_COUNT);
    expect(questionCountForScope({ type: 'lesson', lessonId: 'M01-01-01' }, 20)).toBe(20);
  });

  it('Modulprüfung und Gesamtprüfung haben feste, größere Fragenzahlen', () => {
    expect(questionCountForScope({ type: 'module', moduleId: 'M01' }, 10)).toBe(MODULE_EXAM_QUESTION_COUNT);
    expect(questionCountForScope({ type: 'all' }, 10)).toBe(ALL_EXAM_QUESTION_COUNT);
  });
});

describe('scopeKey', () => {
  it('bildet einen eindeutigen Schlüssel je Geltungsbereich', () => {
    expect(scopeKey({ type: 'lesson', lessonId: 'M01-01-01' })).toBe('M01-01-01');
    expect(scopeKey({ type: 'module', moduleId: 'M01' })).toBe('module:M01');
    expect(scopeKey({ type: 'all' })).toBe('all');
  });
});
