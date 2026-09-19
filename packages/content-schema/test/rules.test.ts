import { describe, expect, it } from 'vitest';
import {
  checkDistractorsSameArea,
  checkExactlyOneCorrectOption,
  checkKeySentenceExactlyOnce,
  checkLongestOptionNotAlwaysCorrect,
  checkTermOrder,
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
        { speaker: 'A', text: 'Wir sprechen hier über Rekursion, ein fortgeschrittenes Konzept.', isKeySentence: true },
        { speaker: 'B', text: 'Rekursion kommt später dran.', isKeySentence: false },
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
        { speaker: 'A', text: 'Im Terminal geben wir jetzt Befehle ein.', isKeySentence: true },
        { speaker: 'B', text: 'Genau, das Terminal kennen wir schon.', isKeySentence: false },
      ],
    });
    expect(checkTermOrder(later, [earlier, later])).toHaveLength(0);
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
