// Reine Ziehungs- und Auswertungslogik einer Quizrunde, dünner Aufsatz auf
// @futuredev/core (quiz.ts). Kein UI-, kein SQLite-Code hier, damit das
// Verhalten ohne Gerät testbar bleibt.
import { drawQuestions, evaluateQuiz, type DrawnQuestion, type QuizAnswer, type QuizQuestionInput, type QuizResult } from '@futuredev/core';

// Modulprüfung mindestens 40 Fragen (lehrplan-konzept.md, Abschnitt 4: "mindestens
// 40 Aufgaben bei kleinen Modulen"), Gesamtprüfung greift über alle Module und
// zieht deshalb mehr.
export const MODULE_EXAM_QUESTION_COUNT = 40;
export const ALL_EXAM_QUESTION_COUNT = 60;
// Mindestens zehn Fragen je Runde, sonst entscheidet Glück statt Wissen
// (feedback_pruefung_zehn_fragen_ein_kreuz).
export const MIN_ROUND_QUESTION_COUNT = 10;

export interface QuizRound {
  drawn: DrawnQuestion[];
  seed: number;
}

/**
 * Zieht eine Runde. Reicht der Fragenpool nicht für die gewünschte Anzahl (kleine
 * Lektion), werden alle vorhandenen Fragen gezogen statt einen Fehler zu werfen.
 */
export function drawRound(pool: QuizQuestionInput[], desiredCount: number, seed: number): QuizRound {
  const count = Math.min(desiredCount, pool.length);
  return { drawn: drawQuestions(pool, count, seed), seed };
}

export function evaluateRound(round: QuizRound, answers: QuizAnswer[]): QuizResult {
  return evaluateQuiz(round.drawn, answers);
}

export interface WrongAnswer {
  questionIndex: number;
  question: string;
  chosenExplanation: string;
  correctText: string;
  correctExplanation: string;
}

/** Liste der falsch beantworteten Fragen mit Begründung, für den Ergebnisbildschirm. */
export function collectWrongAnswers(round: QuizRound, answers: QuizAnswer[]): WrongAnswer[] {
  const wrong: WrongAnswer[] = [];
  for (const answer of answers) {
    const question = round.drawn[answer.questionIndex];
    if (!question) continue;
    const chosen = question.options[answer.chosenOptionIndex];
    if (chosen?.isCorrect) continue;
    const correct = question.options.find((o) => o.isCorrect);
    wrong.push({
      questionIndex: answer.questionIndex,
      question: question.question,
      chosenExplanation: chosen?.explanation ?? '',
      correctText: correct?.text ?? '',
      correctExplanation: correct?.explanation ?? '',
    });
  }
  return wrong;
}

export type QuizScope = { type: 'lesson'; lessonId: string } | { type: 'module'; moduleId: string } | { type: 'all' };

export function questionCountForScope(scope: QuizScope, quizLength: number): number {
  if (scope.type === 'lesson') return Math.max(MIN_ROUND_QUESTION_COUNT, quizLength);
  if (scope.type === 'module') return MODULE_EXAM_QUESTION_COUNT;
  return ALL_EXAM_QUESTION_COUNT;
}

export function scopeKey(scope: QuizScope): string {
  if (scope.type === 'lesson') return scope.lessonId;
  if (scope.type === 'module') return `module:${scope.moduleId}`;
  return 'all';
}
