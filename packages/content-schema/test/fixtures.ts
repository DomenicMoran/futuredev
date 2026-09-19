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

/**
 * Fünf gültige faq-Einträge, deren Text wortgleich in den role:"faq"-Blöcken
 * von makeValidLesson() wiederkehrt (checkFaqBlocksMatchEntries). Jede Antwort
 * hat mindestens zwei vollständige Sätze.
 */
export function makeValidFaq(): Lesson['faq'] {
  return [
    {
      question: 'Muss ich das Terminal fürchten?',
      answer: 'Nein, das Terminal ist nur ein Werkzeug. Mit der Zeit wird die Eingabe von Befehlen ganz normal.',
    },
    {
      question: 'Was passiert, wenn ich einen falschen Befehl eintippe?',
      answer: 'Meist erscheint nur eine Fehlermeldung. Du kannst es einfach noch einmal versuchen.',
    },
    {
      question: 'Brauche ich das Terminal für jede Aufgabe?',
      answer: 'Nein, viele Aufgaben gehen auch per Klick. Für manche Werkzeuge ist das Terminal aber schneller.',
    },
    {
      question: 'Kann ich im Terminal etwas kaputt machen?',
      answer: 'Meistens nicht, solange du keine Löschbefehle eingibst. Am Anfang reicht es, nur zu lesen und auszuprobieren.',
    },
    {
      question: 'Sieht das Terminal auf jedem Rechner gleich aus?',
      answer: 'Nein, es unterscheidet sich je nach Betriebssystem leicht. Der Grundgedanke bleibt aber überall derselbe.',
    },
  ];
}

/** speechBlocks, die exakt zu makeValidFaq() passen: role:"faq" am Ende, B fragt, A antwortet. */
function makeValidFaqBlocks(): Lesson['speechBlocks'] {
  return makeValidFaq().flatMap((entry) => [
    { speaker: 'B' as const, text: entry.question, isKeySentence: false, role: 'faq' as const },
    { speaker: 'A' as const, text: entry.answer, isKeySentence: false, role: 'faq' as const },
  ]);
}

export function makeValidLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'M01-01-01',
    title: 'Testlektion',
    durationMinutes: 10,
    prerequisites: [],
    terms: [{ term: 'Terminal', definition: 'Ein Werkzeug zur Texteingabe von Befehlen' }],
    speechBlocks: [
      {
        speaker: 'A',
        text: 'Stell dir ein Fenster vor, in das du direkt Befehle eintippst.',
        isKeySentence: false,
        role: 'image',
      },
      { speaker: 'A', text: 'Genau so ein Fenster nennt man Terminal.', isKeySentence: false, role: 'term' },
      {
        speaker: 'A',
        text: 'Im Terminal tippst du zum Beispiel ls ein, um Dateien aufzulisten.',
        isKeySentence: false,
        role: 'example',
      },
      {
        speaker: 'B',
        text: 'Heißt das, ich tippe dort Befehle statt zu klicken?',
        isKeySentence: false,
        role: 'question',
      },
      {
        speaker: 'A',
        text: 'Genau: das Terminal ist ein Textfenster für Befehle, du tippst statt zu klicken.',
        isKeySentence: true,
        role: 'key',
      },
      {
        speaker: 'A',
        text: 'Terminal: ein Werkzeug zur Texteingabe von Befehlen.',
        isKeySentence: false,
        role: 'terms_list',
      },
      ...makeValidFaqBlocks(),
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
    faq: makeValidFaq(),
    ...overrides,
  };
}
