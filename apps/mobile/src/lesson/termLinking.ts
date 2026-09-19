import type { SpeechBlock } from '@futuredev/content-schema';

export interface TextSegment {
  text: string;
  term: string | null; // gesetzt, wenn dieses Segment das erste Vorkommen eines Begriffs ist
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Findet, auf Wortgrenzen geachtet, das erste Vorkommen eines Begriffs in
 * einem Text. Nutzt Unicode-Eigenschaften statt \b, weil \b bei Umlauten
 * (ä, ö, ü, ß) ohne den "u"-Modus falsch grenzt. Gibt den Index im Text
 * zurueck oder -1.
 */
export function findFirstWordMatch(text: string, term: string): number {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'u');
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

/**
 * Zerlegt jeden Sprechblock in Textsegmente, wobei jeder eingefuehrte Begriff
 * genau bei seinem ersten Vorkommen ueber die ganze Lektion hinweg markiert
 * wird (Technikvorgabe: "erste Vorkommen reichen"). Reine Funktion, kein
 * Zustand, kein RN-Import: ohne Emulator testbar.
 */
export function linkTermsInBlocks(blocks: readonly SpeechBlock[], terms: readonly { term: string }[]): TextSegment[][] {
  const remaining = new Set(terms.map((t) => t.term));
  return blocks.map((block) => segmentBlock(block.text, remaining));
}

function segmentBlock(text: string, remainingTerms: Set<string>): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  let guard = 0;

  while (cursor < text.length && guard < 200) {
    guard += 1;
    let best: { index: number; term: string } | null = null;
    for (const term of remainingTerms) {
      const idx = findFirstWordMatch(text.slice(cursor), term);
      if (idx === -1) continue;
      const absoluteIndex = cursor + idx;
      if (!best || absoluteIndex < best.index) {
        best = { index: absoluteIndex, term };
      }
    }
    if (!best) break;
    if (best.index > cursor) {
      segments.push({ text: text.slice(cursor, best.index), term: null });
    }
    segments.push({ text: text.slice(best.index, best.index + best.term.length), term: best.term });
    remainingTerms.delete(best.term);
    cursor = best.index + best.term.length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), term: null });
  }
  return segments;
}
