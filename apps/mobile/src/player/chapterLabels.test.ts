import { describe, expect, it } from 'vitest';
import type { CueBlock } from '@futuredev/content-schema';
import { chapterRowLabel, isSectionBoundary, normalizeSpeechPreview, speechPreview } from './chapterLabels.js';

describe('normalizeSpeechPreview', () => {
  it('faltet Zeilenumbrüche zusammen', () => {
    expect(normalizeSpeechPreview('Zeile eins.\nZeile zwei.')).toBe('Zeile eins. Zeile zwei.');
  });
});

describe('speechPreview', () => {
  it('kürzt lange Texte mit Ellipse', () => {
    const long = 'Wort '.repeat(40).trim();
    expect(speechPreview(long, 30).endsWith('…')).toBe(true);
  });
});

describe('chapterRowLabel', () => {
  const block: CueBlock = {
    index: 1,
    speaker: 'A',
    startSeconds: 0,
    durationSeconds: 2,
    isKeySentence: false,
  };

  it('nutzt Sprechtext statt Sprecher-Buchstabe', () => {
    expect(chapterRowLabel(block, ['', 'Stell dir eine Werkbank vor.'])).toBe('Stell dir eine Werkbank vor.');
  });

  it('zeigt Platzhalter während Sprechtexte noch laden', () => {
    expect(chapterRowLabel(block, undefined)).toBe('…');
  });

  it('nutzt Abschnitt statt Sprecher bei leerem Slot in geladener Liste', () => {
    expect(chapterRowLabel(block, ['', ''])).toBe('Abschnitt');
  });
});

describe('isSectionBoundary', () => {
  it('erkennt Abschnittswechsel', () => {
    const a: CueBlock = { index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 1, isKeySentence: false, section: 'body' };
    const b: CueBlock = { index: 1, speaker: 'A', startSeconds: 2, durationSeconds: 1, isKeySentence: false, section: 'terms' };
    expect(isSectionBoundary(a, undefined)).toBe(true);
    expect(isSectionBoundary(b, a)).toBe(true);
    expect(isSectionBoundary({ ...b, section: 'body' }, a)).toBe(false);
  });
});
