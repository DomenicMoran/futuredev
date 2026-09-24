import { describe, expect, it } from 'vitest';
import {
  checkDistractorsSameArea,
  checkExactlyOneCorrectOption,
  checkFaqBlocksMatchEntries,
  checkKeySentenceExactlyOnce,
  checkKeySentenceHasKeyRole,
  checkLongestOptionNotAlwaysCorrect,
  checkMinimumWordCount,
  checkNoPrerequisiteCycles,
  checkPrerequisitesAreEarlier,
  checkPrerequisitesExist,
  checkSentenceLength,
  checkTermBlockFollowedByExample,
  checkTermOrder,
  checkTermsHaveImageOrExample,
  checkTermsListCoversTerms,
} from '../src/rules.js';
import { makeValidLesson, makeValidQuiz } from './fixtures.js';

describe('checkExactlyOneCorrectOption', () => {
  it('meldet keinen Verstoß bei genau einer richtigen Option', () => {
    expect(checkExactlyOneCorrectOption(makeValidLesson())).toHaveLength(0);
  });

  it('meldet einen Verstoß bei zwei richtigen Optionen', () => {
    const lesson = makeValidLesson();
    const quiz = lesson.quiz.map((q, i) =>
      i === 0
        ? { ...q, options: q.options.map((o, j) => (j === 1 ? { ...o, isCorrect: true } : o)) }
        : q,
    );
    const violations = checkExactlyOneCorrectOption({ ...lesson, quiz });
    expect(violations).toHaveLength(1);
  });

  it('meldet einen Verstoß bei null richtigen Optionen', () => {
    const lesson = makeValidLesson();
    const quiz = lesson.quiz.map((q, i) =>
      i === 0 ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: false })) } : q,
    );
    const violations = checkExactlyOneCorrectOption({ ...lesson, quiz });
    expect(violations).toHaveLength(1);
  });
});

describe('checkLongestOptionNotAlwaysCorrect', () => {
  it('lässt einen Anteil von 0% durch', () => {
    expect(checkLongestOptionNotAlwaysCorrect(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt ab, wenn die längste Option in mehr als 40% der Fragen richtig ist', () => {
    const quiz = makeValidQuiz().map((q, i) => {
      if (i < 5) {
        // Richtige Option zur längsten machen (5 von 10 = 50%).
        return {
          ...q,
          options: q.options.map((o, j) =>
            j === 0 ? { ...o, text: 'eine sehr sehr lange richtige antwort hier' } : o,
          ),
        };
      }
      return q;
    });
    const violations = checkLongestOptionNotAlwaysCorrect(makeValidLesson({ quiz }));
    expect(violations).toHaveLength(1);
  });

  it('lässt genau 40% durch (Grenzfall)', () => {
    const quiz = makeValidQuiz().map((q, i) => {
      if (i < 4) {
        return {
          ...q,
          options: q.options.map((o, j) =>
            j === 0 ? { ...o, text: 'eine sehr sehr lange richtige antwort hier' } : o,
          ),
        };
      }
      return q;
    });
    const violations = checkLongestOptionNotAlwaysCorrect(makeValidLesson({ quiz }));
    expect(violations).toHaveLength(0);
  });
});

describe('checkKeySentenceExactlyOnce', () => {
  it('lässt genau einen Kernsatz durch', () => {
    expect(checkKeySentenceExactlyOnce(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt null Kernsätze ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) => ({ ...b, isKeySentence: false }));
    expect(checkKeySentenceExactlyOnce({ ...lesson, speechBlocks })).toHaveLength(1);
  });

  it('lehnt zwei Kernsätze ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) => ({ ...b, isKeySentence: true }));
    expect(checkKeySentenceExactlyOnce({ ...lesson, speechBlocks })).toHaveLength(1);
  });
});

describe('checkTermOrder', () => {
  it('lässt eine Lektion durch, die nur eigene Begriffe benutzt', () => {
    const lesson = makeValidLesson();
    expect(checkTermOrder(lesson, [lesson])).toHaveLength(0);
  });

  it('lehnt eine Lektion ab, die einen Begriff aus einer späteren, nicht vorausgesetzten Lektion benutzt', () => {
    const earlier = makeValidLesson({
      id: 'M01-01-01',
      speechBlocks: [
        {
          speaker: 'A',
          text: 'Wir sprechen hier über Rekursion, ein fortgeschrittenes Konzept.',
          isKeySentence: true,
          role: 'key',
        },
        { speaker: 'B', text: 'Rekursion kommt später dran.', isKeySentence: false, role: 'question' },
      ],
      terms: [{ term: 'Terminal', definition: 'Textfenster für Befehle' }],
    });
    const later = makeValidLesson({
      id: 'M02-01-01',
      terms: [{ term: 'Rekursion', definition: 'Eine Funktion ruft sich selbst auf' }],
    });
    const violations = checkTermOrder(earlier, [earlier, later]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('lässt einen Begriff aus einer vorausgesetzten Lektion durch', () => {
    const earlier = makeValidLesson({
      id: 'M01-01-01',
      terms: [{ term: 'Terminal', definition: 'Textfenster für Befehle' }],
    });
    const later = makeValidLesson({
      id: 'M02-01-01',
      prerequisites: ['M01-01-01'],
      speechBlocks: [
        { speaker: 'A', text: 'Im Terminal geben wir jetzt Befehle ein.', isKeySentence: true, role: 'key' },
        { speaker: 'B', text: 'Genau, das Terminal kennen wir schon.', isKeySentence: false, role: 'question' },
      ],
    });
    expect(checkTermOrder(later, [earlier, later])).toHaveLength(0);
  });

  it('lässt einen Begriff aus einer transitiv vorausgesetzten Lektion durch, ohne dass sie direkt gelistet ist', () => {
    const first = makeValidLesson({
      id: 'M01-00-01',
      terms: [{ term: 'Terminal', definition: 'Textfenster für Befehle' }],
    });
    const middle = makeValidLesson({ id: 'M01-01-01', prerequisites: ['M01-00-01'] });
    const last = makeValidLesson({
      id: 'M02-01-01',
      prerequisites: ['M01-01-01'],
      speechBlocks: [
        { speaker: 'A', text: 'Im Terminal geben wir jetzt Befehle ein.', isKeySentence: true, role: 'key' },
        { speaker: 'B', text: 'Genau, das Terminal kennen wir schon.', isKeySentence: false, role: 'question' },
      ],
    });
    expect(checkTermOrder(last, [first, middle, last])).toHaveLength(0);
  });

  it('erkennt einen Begriff mit Umlaut über eine Wortgrenze hinweg', () => {
    const earlier = makeValidLesson({
      id: 'M01-00-01',
      terms: [{ term: 'öffentliche Adresse', definition: 'Eine im Internet sichtbare Adresse' }],
    });
    const later = makeValidLesson({
      id: 'M02-01-01',
      speechBlocks: [
        {
          speaker: 'A',
          text: 'Dieser Server hat eine öffentliche Adresse.',
          isKeySentence: true,
          role: 'key',
        },
        { speaker: 'B', text: 'Woher kommt diese Adresse?', isKeySentence: false, role: 'question' },
      ],
    });
    const violations = checkTermOrder(later, [earlier, later]);
    expect(violations.some((v) => v.message.includes('öffentliche Adresse'))).toBe(true);
  });
});

describe('checkTermOrder (Kürzel Groß-/Kleinschreibung)', () => {
  it('verwechselt ein grossgeschriebenes Kürzel nicht mit einem gleichnamigen deutschen Wort', () => {
    const earlier = makeValidLesson({
      id: 'M01-00-01',
      terms: [{ term: 'POST', definition: 'Eine HTTP-Methode zum Senden von Daten' }],
    });
    const later = makeValidLesson({
      id: 'M02-01-01',
      speechBlocks: [
        {
          speaker: 'A',
          text: 'Die Post bringt den Brief zum richtigen Haus.',
          isKeySentence: true,
          role: 'key',
        },
        { speaker: 'B', text: 'Wie findet die Post das richtige Haus?', isKeySentence: false, role: 'question' },
      ],
    });
    expect(checkTermOrder(later, [earlier, later])).toHaveLength(0);
  });

  it('erkennt das Kürzel weiterhin in exakter Schreibweise', () => {
    const earlier = makeValidLesson({
      id: 'M01-00-01',
      terms: [{ term: 'POST', definition: 'Eine HTTP-Methode zum Senden von Daten' }],
    });
    const later = makeValidLesson({
      id: 'M02-01-01',
      speechBlocks: [
        { speaker: 'A', text: 'Mit POST schickt der Browser neue Daten an den Server.', isKeySentence: true, role: 'key' },
        { speaker: 'B', text: 'Und wann benutzt man POST?', isKeySentence: false, role: 'question' },
      ],
    });
    expect(checkTermOrder(later, [earlier, later]).length).toBeGreaterThan(0);
  });
});

describe('checkPrerequisitesExist', () => {
  it('lässt vorhandene Voraussetzungen durch', () => {
    const a = makeValidLesson({ id: 'M01-00-01' });
    const b = makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-01'] });
    expect(checkPrerequisitesExist(b, [a, b])).toHaveLength(0);
  });

  it('lehnt eine Voraussetzung auf eine nicht vorhandene Lektion ab', () => {
    const b = makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-99'] });
    expect(checkPrerequisitesExist(b, [b])).toHaveLength(1);
  });
});

describe('checkPrerequisitesAreEarlier', () => {
  it('lässt eine frühere Kennung als Voraussetzung durch', () => {
    const lesson = makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-01'] });
    expect(checkPrerequisitesAreEarlier(lesson)).toHaveLength(0);
  });

  it('lehnt eine spätere Kennung als Voraussetzung ab', () => {
    const lesson = makeValidLesson({ id: 'M01-00-01', prerequisites: ['M01-00-02'] });
    expect(checkPrerequisitesAreEarlier(lesson)).toHaveLength(1);
  });

  it('lehnt die eigene Kennung als Voraussetzung ab', () => {
    const lesson = makeValidLesson({ id: 'M01-00-01', prerequisites: ['M01-00-01'] });
    expect(checkPrerequisitesAreEarlier(lesson)).toHaveLength(1);
  });
});

describe('checkNoPrerequisiteCycles', () => {
  it('lässt eine azyklische Kette durch', () => {
    const a = makeValidLesson({ id: 'M01-00-01' });
    const b = makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-01'] });
    expect(checkNoPrerequisiteCycles(b, [a, b])).toHaveLength(0);
  });

  it('erkennt einen Zyklus über zwei Lektionen', () => {
    const a = makeValidLesson({ id: 'M01-00-01', prerequisites: ['M01-00-02'] });
    const b = makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-01'] });
    expect(checkNoPrerequisiteCycles(a, [a, b]).length).toBeGreaterThan(0);
  });

  it('beendet Diamant-DAGs ohne exponentielle Laufzeit', () => {
    // Viele gemeinsame Vorfahren: ohne „done"-Menge explodiert die Suche.
    const lessons = [
      makeValidLesson({ id: 'M01-00-01' }),
      makeValidLesson({ id: 'M01-00-02', prerequisites: ['M01-00-01'] }),
      makeValidLesson({ id: 'M01-00-03', prerequisites: ['M01-00-01'] }),
      makeValidLesson({ id: 'M01-00-04', prerequisites: ['M01-00-02', 'M01-00-03'] }),
      makeValidLesson({ id: 'M01-00-05', prerequisites: ['M01-00-02', 'M01-00-03'] }),
      makeValidLesson({
        id: 'M01-00-06',
        prerequisites: ['M01-00-04', 'M01-00-05'],
      }),
    ];
    const started = Date.now();
    const diamondMerge = lessons.at(5);
    if (diamondMerge === undefined) {
      throw new Error('Test-Setup: sechste Lektion fehlt');
    }
    expect(checkNoPrerequisiteCycles(diamondMerge, lessons)).toHaveLength(0);
    expect(Date.now() - started).toBeLessThan(100);
  });
});

describe('checkDistractorsSameArea', () => {
  it('lässt Ablenker ohne fremde Modulbegriffe durch', () => {
    const lesson = makeValidLesson();
    expect(checkDistractorsSameArea(lesson, [lesson])).toHaveLength(0);
  });

  it('lehnt einen Ablenker ab, der wörtlich ein Begriff aus einem fremden Modul ist', () => {
    const other = makeValidLesson({ id: 'M05-01-01', terms: [{ term: 'Gradle', definition: 'Android-Baustandard' }] });
    const lesson = makeValidLesson();
    const quiz = lesson.quiz.map((q, i) =>
      i === 0
        ? { ...q, options: q.options.map((o, j) => (j === 1 ? { ...o, text: 'Gradle' } : o)) }
        : q,
    );
    const violations = checkDistractorsSameArea({ ...lesson, quiz }, [lesson, other]);
    expect(violations).toHaveLength(1);
  });
});

describe('checkKeySentenceHasKeyRole', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkKeySentenceHasKeyRole(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt isKeySentence:true mit einer anderen role als "key" ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) =>
      b.isKeySentence ? { ...b, role: 'explain' as const } : b,
    );
    expect(checkKeySentenceHasKeyRole({ ...lesson, speechBlocks })).toHaveLength(1);
  });

  it('lehnt role:"key" ohne isKeySentence:true ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b, i) => (i === 0 ? { ...b, role: 'key' as const } : b));
    expect(checkKeySentenceHasKeyRole({ ...lesson, speechBlocks })).toHaveLength(1);
  });
});

describe('checkFaqBlocksMatchEntries', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkFaqBlocksMatchEntries(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt ab, wenn ein faq-Block vom Eintragstext abweicht', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b, i) =>
      i === lesson.speechBlocks.length - 1 ? { ...b, text: 'Ein anderer Antworttext.' } : b,
    );
    expect(checkFaqBlocksMatchEntries({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });

  it('lehnt ab, wenn die Anzahl der faq-Blöcke nicht zur Eintragszahl passt', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.slice(0, -1);
    expect(checkFaqBlocksMatchEntries({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });

  it('lehnt ab, wenn nach den faq-Blöcken noch ein anderer Block folgt', () => {
    const lesson = makeValidLesson();
    const speechBlocks = [
      ...lesson.speechBlocks,
      { speaker: 'A' as const, text: 'Nachtrag nach den FAQ.', isKeySentence: false, role: 'explain' as const },
    ];
    expect(checkFaqBlocksMatchEntries({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });
});

describe('checkTermsListCoversTerms', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkTermsListCoversTerms(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt eine Lektion ohne role:"terms_list"-Block ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) =>
      b.role === 'terms_list' ? { ...b, role: 'explain' as const } : b,
    );
    expect(checkTermsListCoversTerms({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });

  it('lehnt ab, wenn ein Begriff in der Liste fehlt', () => {
    const lesson = makeValidLesson({
      terms: [
        { term: 'Terminal', definition: 'Ein Werkzeug zur Texteingabe von Befehlen' },
        { term: 'Prompt', definition: 'Der Text, der auf die Eingabe wartet' },
      ],
    });
    expect(checkTermsListCoversTerms(lesson).length).toBeGreaterThan(0);
  });
});

describe('checkTermsHaveImageOrExample', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkTermsHaveImageOrExample(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt ab, wenn kein image/example-Block den Begriff nennt', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) =>
      b.role === 'example' ? { ...b, text: 'Ein Beispiel ohne den Begriff.' } : b,
    );
    // image-Block (Index 0) nennt den Begriff ohnehin nicht, siehe Fixture.
    expect(checkTermsHaveImageOrExample({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });
});

describe('checkTermBlockFollowedByExample', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkTermBlockFollowedByExample(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt einen term-Block ohne example/image in den nächsten drei Blöcken ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b) =>
      b.role === 'example' ? { ...b, role: 'explain' as const } : b,
    );
    expect(checkTermBlockFollowedByExample({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });
});

describe('checkSentenceLength', () => {
  it('lässt eine gültige Lektion durch', () => {
    expect(checkSentenceLength(makeValidLesson())).toHaveLength(0);
  });

  it('lehnt einen einzelnen Satz mit mehr als 35 Wörtern ab', () => {
    const lesson = makeValidLesson();
    const longSentence = `Das ist ein sehr langer Satz, ${'der immer weiter und weiter und weiter und weiter und weiter und weiter und weiter geht '.repeat(2)}und trotzdem nicht endet.`;
    const speechBlocks = lesson.speechBlocks.map((b, i) => (i === 0 ? { ...b, text: longSentence } : b));
    const violations = checkSentenceLength({ ...lesson, speechBlocks });
    expect(violations.some((v) => v.rule === 'maximale-satzlaenge')).toBe(true);
  });

  it('lehnt eine mittlere Satzlänge ab 20 Wörtern ab', () => {
    const lesson = makeValidLesson();
    const speechBlocks = [
      {
        speaker: 'A' as const,
        role: 'explain' as const,
        isKeySentence: false,
        text: 'Dies ist ein einziger Block mit genau einem sehr langen Satz der mit voller Absicht über zwanzig Wörter im Mittel erreicht damit die Regel greift.',
      },
    ];
    const violations = checkSentenceLength({ ...lesson, speechBlocks });
    expect(violations.some((v) => v.rule === 'mittlere-satzlaenge')).toBe(true);
  });

  it('behandelt buchstabierte Abkürzungen nicht als Satzende', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b, i) =>
      i === 0 ? { ...b, text: 'CPU. C, P, U. So heißt der Prozessor kurz.' } : b,
    );
    expect(checkSentenceLength({ ...lesson, speechBlocks })).toHaveLength(0);
  });
});

describe('checkMinimumWordCount', () => {
  it('lässt eine ausreichend lange Lektion durch', () => {
    const lesson = makeValidLesson();
    const longBlock = { speaker: 'A' as const, role: 'explain' as const, isKeySentence: false, text: 'Wort '.repeat(2600).trim() };
    const violations = checkMinimumWordCount({ ...lesson, speechBlocks: [...lesson.speechBlocks, longBlock] }, '0.1.0');
    expect(violations).toHaveLength(0);
  });

  it('meldet eine Warnung unter Manifest-Version 0.2.0', () => {
    const violations = checkMinimumWordCount(makeValidLesson(), '0.1.0');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('warning');
  });

  it('meldet einen Fehler ab Manifest-Version 0.2.0', () => {
    // Nicht die Fixture-Kennung M01-01-01 nehmen: die steht auf der benannten
    // Ausnahmeliste (AP-4.2) und bliebe deshalb bei einer Warnung.
    const lesson = makeValidLesson({ id: 'M02-01-01' });
    const violations = checkMinimumWordCount(lesson, '0.2.0');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('error');
  });

  it('kennt keine Ausnahme mehr für M01-01-01 unter 0.2.0', () => {
    const violations = checkMinimumWordCount(makeValidLesson({ id: 'M01-01-01' }), '0.2.0');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('error');
    expect(violations[0]?.message).not.toContain('Ausnahme');
  });
});
