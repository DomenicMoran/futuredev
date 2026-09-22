import { describe, expect, it } from 'vitest';
import { generateStableQuestions } from './generateStableQuestions.js';

const sampleItem = {
  id: 'P00',
  title: 'Erste Zeile Code im Terminal',
  goal: 'Ein eigenes Skript im Terminal ausführen.',
  proof: 'Terminal-Grundlagen sitzen.',
};

describe('generateStableQuestions', () => {
  it('liefert stabil 2 oder 3 Fragen mit deutscher Formulierung', () => {
    const first = generateStableQuestions(sampleItem);
    const second = generateStableQuestions(sampleItem);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.length).toBeLessThanOrEqual(3);
    expect(first.every((q) => q.question.length > 10 && q.sampleAnswer.length > 5)).toBe(true);
    expect(first.every((q) => q.id.startsWith('P00-q'))).toBe(true);
  });

  it('unterscheidet Bausteine anhand der id', () => {
    const p00 = generateStableQuestions(sampleItem);
    const p01 = generateStableQuestions({
      id: 'P01',
      title: 'Statische Seite auf Vercel mit eigener Domain',
      goal: 'Eine Seite live im Netz veröffentlichen.',
      proof: 'HTML/CSS, Git, Deploy-Grundverständnis.',
    });

    expect(p00[0]?.question).not.toBe(p01[0]?.question);
  });
});
