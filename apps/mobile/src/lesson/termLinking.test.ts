import { describe, expect, it } from 'vitest';
import { findFirstWordMatch, linkTermsInBlocks } from './termLinking.js';

describe('findFirstWordMatch', () => {
  it('findet einen Begriff nur an einer Wortgrenze, nicht als Teil eines anderen Wortes', () => {
    expect(findFirstWordMatch('Die CPU rechnet.', 'CPU')).toBe(4);
    expect(findFirstWordMatch('CPUartig ist kein Treffer', 'CPU')).toBe(-1);
  });

  it('grenzt korrekt bei Umlauten (kein \\b-Fehler)', () => {
    expect(findFirstWordMatch('Größe der Festplatte', 'Größe')).toBe(0);
  });

  it('liefert -1, wenn der Begriff nicht vorkommt', () => {
    expect(findFirstWordMatch('Ein Satz ohne den Begriff', 'CPU')).toBe(-1);
  });
});

describe('linkTermsInBlocks', () => {
  const terms = [{ term: 'CPU' }, { term: 'Arbeitsspeicher' }];

  it('markiert jeden Begriff nur beim ersten Vorkommen ueber alle Bloecke hinweg', () => {
    const blocks = [
      { speaker: 'A' as const, text: 'Die CPU rechnet, die CPU ist schnell.', isKeySentence: false, role: 'explain' as const },
      { speaker: 'A' as const, text: 'Der Arbeitsspeicher haelt Daten, die CPU nutzt ihn.', isKeySentence: false, role: 'explain' as const },
    ];
    const result = linkTermsInBlocks(blocks, terms);

    const linkedInBlock1 = (result[0] ?? []).filter((s) => s.term === 'CPU');
    expect(linkedInBlock1).toHaveLength(1);
    const linkedInBlock2 = (result[1] ?? []).filter((s) => s.term !== null);
    expect(linkedInBlock2.map((s) => s.term)).toEqual(['Arbeitsspeicher']);
  });

  it('baut den Originaltext aus den Segmenten wieder zusammen', () => {
    const blocks = [{ speaker: 'A' as const, text: 'Die CPU rechnet Schritt fuer Schritt.', isKeySentence: false, role: 'explain' as const }];
    const result = linkTermsInBlocks(blocks, terms);
    expect((result[0] ?? []).map((s) => s.text).join('')).toBe(blocks[0]?.text);
  });

  it('funktioniert ohne Begriffe (leere Liste)', () => {
    const blocks = [{ speaker: 'A' as const, text: 'Ganz normaler Text.', isKeySentence: false, role: 'explain' as const }];
    expect(linkTermsInBlocks(blocks, [])).toEqual([[{ text: 'Ganz normaler Text.', term: null }]]);
  });
});
