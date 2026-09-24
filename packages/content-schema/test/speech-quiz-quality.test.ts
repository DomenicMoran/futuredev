import { describe, expect, it } from 'vitest';
import {
  checkDuplicateQuizStems,
  checkQuizMetaDistractors,
  checkSpeechBlockTtsBreaks,
  hasTtsMidSentenceBreak,
} from '../src/speech-quiz-quality.js';
import { makeValidLesson } from './fixtures.js';

describe('hasTtsMidSentenceBreak', () => {
  it('erkennt mitten im Satz getrennte Wörter', () => {
    expect(hasTtsMidSentenceBreak('Der Computer muss sich. behelfen')).toBe(true);
  });

  it('ignoriert z. B.', () => {
    expect(hasTtsMidSentenceBreak('Das gilt z. B. für Browser.')).toBe(false);
  });
});

describe('checkSpeechBlockTtsBreaks', () => {
  it('meldet TTS-Artefakte in speechBlocks', () => {
    const lesson = makeValidLesson();
    const speechBlocks = lesson.speechBlocks.map((b, i) =>
      i === 0 ? { ...b, text: 'Es ist. kalt draußen.' } : b,
    );
    expect(checkSpeechBlockTtsBreaks({ ...lesson, speechBlocks }).length).toBeGreaterThan(0);
  });
});

describe('checkQuizMetaDistractors', () => {
  it('meldet Platzhalter-Ablenker', () => {
    const lesson = makeValidLesson();
    const quiz = lesson.quiz.map((q, i) =>
      i === 0
        ? {
            ...q,
            options: q.options.map((o, j) =>
              j === 1
                ? { ...o, text: `${o.text} (häufige Verwechslung in diesem Themenfeld)` }
                : o,
            ),
          }
        : q,
    );
    expect(checkQuizMetaDistractors({ ...lesson, quiz }).length).toBeGreaterThan(0);
  });
});

describe('checkDuplicateQuizStems', () => {
  it('meldet doppelte Frage-Stämme', () => {
    const lesson = makeValidLesson();
    const first = lesson.quiz[0];
    const second = lesson.quiz[1];
    if (!first || !second) throw new Error('fixture quiz zu kurz');
    const quiz = [...lesson.quiz];
    quiz[1] = { ...second, question: first.question };
    expect(checkDuplicateQuizStems({ ...lesson, quiz }).length).toBeGreaterThan(0);
  });
});
