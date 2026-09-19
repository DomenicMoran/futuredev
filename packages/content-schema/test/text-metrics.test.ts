import { describe, expect, it } from 'vitest';
import { countSentences, countWords, splitSentences } from '../src/text-metrics.js';

describe('splitSentences', () => {
  it('trennt an Punkt, Ausrufezeichen und Fragezeichen', () => {
    expect(splitSentences('Erster Satz. Zweiter Satz! Dritter Satz?')).toEqual([
      'Erster Satz.',
      'Zweiter Satz!',
      'Dritter Satz?',
    ]);
  });

  it('behandelt eine buchstabierte Abkürzung nicht als Satzende', () => {
    expect(splitSentences('CPU. C, P, U.')).toEqual(['CPU.', 'C, P, U.']);
  });

  it('behandelt "z. B." nicht als Satzende', () => {
    const result = splitSentences('Manche Bauteile, z. B. der Bildschirm, sind Hardware.');
    expect(result).toHaveLength(1);
  });

  it('behandelt bekannte mehrbuchstabige Abkürzungen nicht als Satzende', () => {
    const result = splitSentences('Es gibt viele Bauteile, usw. sind das Beispiele.');
    expect(result).toHaveLength(1);
  });

  it('behandelt "u. a." nicht als Satzende (zwei buchstabierte Einzelbuchstaben)', () => {
    const result = splitSentences('Es gibt Eingabegeräte, u. a. Tastatur und Maus.');
    expect(result).toHaveLength(1);
  });

  it('behandelt "bzw." nicht als Satzende', () => {
    const result = splitSentences('Das Programm bzw. der Code läuft auf dem Computer.');
    expect(result).toHaveLength(1);
  });

  it('gibt eine leere Liste für einen leeren Text zurück', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

describe('countWords', () => {
  it('zählt Wörter getrennt durch Leerraum', () => {
    expect(countWords('Ein kurzer Satz hier')).toBe(4);
  });

  it('gibt 0 für einen leeren Text zurück', () => {
    expect(countWords('   ')).toBe(0);
  });
});

describe('countSentences', () => {
  it('zählt zwei vollständige Sätze', () => {
    expect(countSentences('Erster Satz. Zweiter Satz.')).toBe(2);
  });

  it('zählt einen einzigen Satz bei einer Abkürzung nicht doppelt', () => {
    expect(countSentences('Das ist z. B. ein Satz.')).toBe(1);
  });
});
