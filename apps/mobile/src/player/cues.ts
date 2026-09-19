// Suche in der Cue-Datei (Kapitelmarken): Block zu einer Wiedergabeposition,
// Position zu einem Blockindex. Reine Funktionen, kein Netz-/Dateizugriff
// (das Laden der Cue-Datei selbst lebt in downloads.ts/index.ts).
import type { CueBlock, CueSheet } from '@futuredev/content-schema';

/**
 * Den Block, der bei `positionSeconds` gerade läuft (letzter Block, dessen
 * startSeconds <= positionSeconds ist). Vor dem ersten Block: Block 0. Nach
 * dem letzten Block (etwa während der Schluss-Stille): letzter Block.
 */
export function findBlockAtPosition(cueSheet: CueSheet, positionSeconds: number): CueBlock {
  const blocks = cueSheet.blocks;
  const first = blocks[0];
  if (!first) {
    throw new Error('findBlockAtPosition: Cue-Datei ohne Blöcke');
  }
  if (positionSeconds <= first.startSeconds) return first;

  let result: CueBlock = first;
  for (const block of blocks) {
    if (block.startSeconds <= positionSeconds) {
      result = block;
    } else {
      break;
    }
  }
  return result;
}

/** Startzeit eines Blockindex, oder 0, wenn der Index nicht existiert (Randfall). */
export function findPositionForBlock(cueSheet: CueSheet, blockIndex: number): number {
  const block = cueSheet.blocks.find((b) => b.index === blockIndex);
  return block?.startSeconds ?? 0;
}

/** Nächster Kernsatz-Block ab (ausschließlich) der aktuellen Position, für Wiederholungsclips. */
export function findNextKeySentenceBlock(cueSheet: CueSheet, afterSeconds: number): CueBlock | undefined {
  return cueSheet.blocks.find((b) => b.isKeySentence && b.startSeconds > afterSeconds);
}

/** Blöcke eines Abschnitts (AW-045: body/terms/example/task/faq), in Reihenfolge. */
export function blocksInSection(cueSheet: CueSheet, section: CueBlock['section']): CueBlock[] {
  return cueSheet.blocks.filter((b) => (b.section ?? 'body') === section);
}
