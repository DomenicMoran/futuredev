import type { QuizQuestionInput } from '@futuredev/core';

/** Verengt `T | undefined` auf `T` für Tests, ohne die verbotene "!"-Zusicherung (no-non-null-assertion). */
export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('unerwartet undefined');
  return value;
}

/** Kleine, deterministische Fragen-Attrappe für Tests (kein echter Lektionsinhalt). */
export function makeTestPool(count: number): QuizQuestionInput[] {
  return Array.from({ length: count }, (_, i) => ({
    question: `Frage ${i}`,
    options: [
      { text: 'richtig', isCorrect: true, explanation: 'weil richtig' },
      { text: 'falsch 1', isCorrect: false, explanation: 'weil falsch 1' },
      { text: 'falsch 2', isCorrect: false, explanation: 'weil falsch 2' },
      { text: 'falsch 3', isCorrect: false, explanation: 'weil falsch 3' },
    ],
  }));
}
