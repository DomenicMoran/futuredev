import type { Lesson } from '../src/lesson.js';

function makeQuestion(
  index: number,
  area: string,
  correctText: string,
  wrongTexts: [string, string, string],
): Lesson['quiz'][number] {
  return {
    question: `Testfrage ${index}?`,
    area,
    options: [
      { text: correctText, isCorrect: true, explanation: 'richtig, weil Testfixture' },
      { text: wrongTexts[0], isCorrect: false, explanation: 'falsch, Ablenker 1' },
      { text: wrongTexts[1], isCorrect: false, explanation: 'falsch, Ablenker 2' },
      { text: wrongTexts[2], isCorrect: false, explanation: 'falsch, Ablenker 3' },
    ],
  };
}

/** Zehn Fragen, in denen die richtige Option nie die längste ist (0% Anteil). */
export function makeValidQuiz(): Lesson['quiz'] {
  return Array.from({ length: 10 }, (_, i) =>
    makeQuestion(i + 1, 'Bereich A', 'ok', ['eine viel längere falsche Antwort', 'falsch b', 'falsch c']),
  );
}

export function makeValidLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'M01-01-01',
    title: 'Testlektion',
    durationMinutes: 10,
    prerequisites: [],
    terms: [{ term: 'Terminal', definition: 'Ein Werkzeug zur Texteingabe von Befehlen' }],
    speechBlocks: [
      { speaker: 'A', text: 'Das Terminal ist ein Textfenster für Befehle.', isKeySentence: true },
      { speaker: 'B', text: 'Also tippt man dort Befehle statt zu klicken.', isKeySentence: false },
    ],
    practiceExample: {
      text: 'Beispiel aus einem Repo.',
      repoNote: 'repo-microsaas',
      location: 'README, Abschnitt Aufbau',
    },
    quiz: makeValidQuiz(),
    practiceTask: {
      task: 'Öffne ein Terminal und liste den aktuellen Ordner auf.',
      expectation: 'Eine Liste von Dateien erscheint.',
      checklist: ['Terminal geöffnet', 'Befehl ausgeführt'],
    },
    audio: {
      file: 'M01-01-01.mp3',
      durationSeconds: 300,
      voices: ['A', 'B'],
      aiGenerated: true,
    },
    ...overrides,
  };
}
