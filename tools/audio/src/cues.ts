// Berechnet die Kapitelmarken-Datei (CueSheet) einer Lektion: Startzeit je
// Sprechblock aus den gemessenen Blockdauern plus den Pausen aus dem
// Zusammenfuegeplan (buildConcatPlan). Reine Funktion, kein Dateizugriff, damit
// sie ohne ffmpeg/ffprobe getestet werden kann.

import type { CueSheet } from '@futuredev/content-schema';
import { buildConcatPlan, type SpeechBlockLike } from './concat-plan.js';

export interface CueSourceBlock extends SpeechBlockLike {
  readonly isKeySentence: boolean;
  readonly section?: 'body' | 'terms' | 'example' | 'task' | 'faq' | undefined;
}

// Drei Nachkommastellen reichen fuer eine Kapitelmarke (Millisekunden) und
// vermeiden Fliesskomma-Rauschen ueber viele addierte Bloecke/Pausen hinweg.
function roundMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/**
 * blockDurationsSeconds: gemessene Dauer je Block (ffprobe je Block-MP3), in
 * derselben Reihenfolge wie blocks. Wirft, wenn die Laengen nicht zusammenpassen,
 * damit ein falsch sortiertes Array frueh auffaellt statt eine falsche Cue-Datei
 * zu erzeugen.
 */
export function buildCueSheet(
  lessonId: string,
  blocks: readonly CueSourceBlock[],
  blockDurationsSeconds: readonly number[],
): CueSheet {
  if (blocks.length !== blockDurationsSeconds.length) {
    throw new Error(
      `buildCueSheet: ${blocks.length} Sprechblöcke, aber ${blockDurationsSeconds.length} gemessene Dauern`,
    );
  }
  if (blocks.length === 0) {
    throw new Error('buildCueSheet: mindestens ein Sprechblock nötig');
  }

  const plan = buildConcatPlan(blocks);
  let cursorSeconds = 0;
  const cueBlocks: CueSheet['blocks'] = [];

  for (const step of plan) {
    if (step.type === 'silence') {
      cursorSeconds += step.milliseconds / 1000;
      continue;
    }
    const block = blocks[step.index];
    const duration = blockDurationsSeconds[step.index];
    if (block === undefined || duration === undefined) {
      throw new Error(`buildCueSheet: Block ${step.index} fehlt in blocks/blockDurationsSeconds`);
    }
    cueBlocks.push({
      index: step.index,
      speaker: block.speaker,
      startSeconds: roundMs(cursorSeconds),
      durationSeconds: roundMs(duration),
      isKeySentence: block.isKeySentence,
      ...(block.section !== undefined ? { section: block.section } : {}),
    });
    cursorSeconds += duration;
  }

  return { lessonId, blocks: cueBlocks };
}
