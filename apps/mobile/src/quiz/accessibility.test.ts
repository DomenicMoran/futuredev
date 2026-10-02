import { describe, expect, it } from 'vitest';
import { quizOptionAnnouncement } from './accessibility.js';

describe('Quiz-Antworten für Screenreader', () => {
  const labels = ['Richtig beantwortet', 'Falsch beantwortet', 'Richtige Antwort'] as const;

  it('kündigt vor der Wahl nur den Antworttext an', () => {
    expect(quizOptionAnnouncement('Option A', true, false, false, ...labels)).toBe('Option A');
  });

  it('kündigt ausgewählte falsche und richtige Antworten separat an', () => {
    expect(quizOptionAnnouncement('Option A', false, true, true, ...labels)).toBe('Option A. Falsch beantwortet');
    expect(quizOptionAnnouncement('Option B', true, true, true, ...labels)).toBe('Option B. Richtig beantwortet');
  });

  it('kündigt bei falscher Auswahl die richtige Alternative an, ohne falsche Ablenker zu markieren', () => {
    expect(quizOptionAnnouncement('Option A', true, false, true, ...labels)).toBe('Option A. Richtige Antwort');
    expect(quizOptionAnnouncement('Option C', false, false, true, ...labels)).toBe('Option C');
  });
});
