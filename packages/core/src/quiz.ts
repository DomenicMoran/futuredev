// Ziehung und Auswertung von Quizfragen. Keine Teilpunkte
// (feedback_teilpunkte_machen_aus_der_frage_eine_rechenaufgabe), 80-Prozent-Grenze
// (feedback_pruefung_zehn_fragen_ein_kreuz).

export interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizQuestionInput {
  question: string;
  options: QuizOptionInput[];
}

export interface DrawnOption extends QuizOptionInput {
  index: number;
}

export interface DrawnQuestion {
  question: string;
  options: DrawnOption[];
}

// Mulberry32: kleiner, deterministischer PRNG. Kein kryptografischer Anspruch,
// nur damit Tests bei gleichem Seed dasselbe Ergebnis bekommen.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

/** Zieht n Fragen ohne Wiederholung und mischt deren Optionen, seed-gesteuert. */
export function drawQuestions(
  questions: QuizQuestionInput[],
  count: number,
  seed: number,
): DrawnQuestion[] {
  if (count > questions.length) {
    throw new Error(`nicht genug Fragen: ${questions.length} vorhanden, ${count} verlangt`);
  }
  const rand = mulberry32(seed);
  const chosen = shuffle(questions, rand).slice(0, count);
  return chosen.map((q) => ({
    question: q.question,
    options: shuffle(
      q.options.map((o, index) => ({ ...o, index })),
      rand,
    ),
  }));
}

export interface QuizAnswer {
  questionIndex: number;
  chosenOptionIndex: number; // Index innerhalb der (gemischten) Optionen
}

export interface QuizResult {
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
}

export const PASS_THRESHOLD_PERCENT = 80;

/** Wertet eine Runde aus: pro Frage genau eine Wahl, kein Teilpunkt. */
export function evaluateQuiz(drawn: DrawnQuestion[], answers: QuizAnswer[]): QuizResult {
  let correctCount = 0;
  for (const answer of answers) {
    const question = drawn[answer.questionIndex];
    if (!question) continue;
    const chosen = question.options[answer.chosenOptionIndex];
    if (chosen?.isCorrect) correctCount += 1;
  }
  const totalCount = drawn.length;
  const scorePercent = totalCount === 0 ? 0 : (correctCount / totalCount) * 100;
  return {
    correctCount,
    totalCount,
    scorePercent,
    passed: scorePercent >= PASS_THRESHOLD_PERCENT,
  };
}
