export interface ExplainQuestionInput {
  id: string;
  title: string;
  goal: string;
  proof: string;
}

export interface ExplainQuestion {
  id: string;
  question: string;
  sampleAnswer: string;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const QUESTION_BLUEPRINTS: {
  buildQuestion: (item: ExplainQuestionInput) => string;
  buildSample: (item: ExplainQuestionInput) => string;
}[] = [
  {
    buildQuestion: (item) => `Was ist das Ziel des Bausteins „${item.title}“?`,
    buildSample: (item) => item.goal,
  },
  {
    buildQuestion: (item) => `Welches Können belegst du mit „${item.title}“?`,
    buildSample: (item) => item.proof,
  },
  {
    buildQuestion: (item) =>
      `Stell dir vor, ein Recruiter fragt nach ${item.id}: Was hast du konkret gemacht und warum?`,
    buildSample: (item) =>
      `${item.goal} Du kannst das mit dem Nachweis untermauern: ${item.proof}`,
  },
  {
    buildQuestion: (item) => `Erkläre in eigenen Worten, wofür „${item.title}“ in deinem Lernweg wichtig ist.`,
    buildSample: (item) =>
      `Der Baustein zeigt, dass du ${item.proof.toLowerCase()} Damit wird ${item.goal.replace(/\.$/, '')} greifbar.`,
  },
];

/**
 * Erzeugt deterministisch 2–3 Erklärfragen pro Portfolio-Baustein (gleiche
 * Eingabe → gleiche Fragen, unabhängig von Laufzeit und Gerät).
 */
export function generateStableQuestions(item: ExplainQuestionInput): ExplainQuestion[] {
  const count = 2 + (stableHash(item.id) % 2);
  const start = stableHash(`${item.id}:${item.title}`) % QUESTION_BLUEPRINTS.length;
  const picked: ExplainQuestion[] = [];

  for (let offset = 0; picked.length < count; offset += 1) {
    const blueprintIndex = (start + offset) % QUESTION_BLUEPRINTS.length;
    const blueprint = QUESTION_BLUEPRINTS[blueprintIndex] ?? QUESTION_BLUEPRINTS[0];
    if (!blueprint) break;
    const index = picked.length;
    picked.push({
      id: `${item.id}-q${index}`,
      question: blueprint.buildQuestion(item),
      sampleAnswer: blueprint.buildSample(item),
    });
  }

  return picked;
}
