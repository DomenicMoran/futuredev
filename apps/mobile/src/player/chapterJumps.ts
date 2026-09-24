import type { BlockRole, CueBlock, CueSheet } from '@futuredev/content-schema';
import { chapterRowLabel, isSectionBoundary, sectionHeading, speechPreview } from './chapterLabels.js';

/** Sinnvolle Sprungliste: wenige Abschnitte statt jedes TTS-Blocks. */
export const CHAPTER_JUMP_MIN = 5;
export const CHAPTER_JUMP_MAX = 12;

export type ChapterJump = {
  block: CueBlock;
  label: string;
  /** Oberzeile nur bei Wechsel in terms/example/task/faq */
  sectionHeading: string | null;
};

/** true, wenn die Cue-Datei mehr als nur einen durchgehenden body-Abschnitt hat. */
export function hasSectionJumpStructure(blocks: readonly CueBlock[]): boolean {
  return blocks.some((b) => (b.section ?? 'body') !== 'body');
}

function isSectionStartAnchor(block: CueBlock, previous: CueBlock | undefined): boolean {
  return isSectionBoundary(block, previous) && (block.section ?? 'body') !== 'body';
}

function collectBodyRoleAnchors(
  blocks: readonly CueBlock[],
  blockRoles: readonly BlockRole[] | undefined,
): Set<number> {
  const anchors = new Set<number>();
  if (!blockRoles) return anchors;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || (block.section ?? 'body') !== 'body') continue;
    const role = blockRoles[block.index];
    if (role !== 'term' && role !== 'why') continue;
    const prev = i > 0 ? blocks[i - 1] : undefined;
    const prevRole = prev ? blockRoles[prev.index] : undefined;
    if (role !== prevRole) anchors.add(i);
  }
  return anchors;
}

function isRemovableAnchor(
  index: number,
  blocks: readonly CueBlock[],
  blockRoles: readonly BlockRole[] | undefined,
): boolean {
  if (index === 0) return false;
  const block = blocks[index];
  if (!block) return false;
  const prev = index > 0 ? blocks[index - 1] : undefined;
  if (isSectionStartAnchor(block, prev)) return false;
  if (block.isKeySentence) return false;
  const role = blockRoles?.[block.index];
  if (role === 'term' || role === 'why') return true;
  return true;
}

function findLongestGapEnd(blocks: readonly CueBlock[], indices: readonly number[]): number | null {
  if (indices.length === 0) return null;
  let bestStart = indices[0] ?? 0;
  let bestEnd = indices[1] ?? blocks.length - 1;
  let bestLen = bestEnd - bestStart;

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i] ?? 0;
    const end = i + 1 < indices.length ? (indices[i + 1] ?? start) : blocks.length - 1;
    const len = end - start;
    if (len > bestLen && end - start >= 2) {
      bestLen = len;
      bestStart = start;
      bestEnd = end;
    }
  }
  if (bestEnd - bestStart < 2) return null;
  return Math.floor((bestStart + bestEnd) / 2);
}

function enforceJumpCount(
  blocks: readonly CueBlock[],
  anchorList: readonly number[],
  blockRoles: readonly BlockRole[] | undefined,
): number[] {
  let indices = [...new Set(anchorList)].sort((a, b) => a - b);

  while (indices.length > CHAPTER_JUMP_MAX) {
    let removed = false;
    for (let i = indices.length - 1; i >= 0; i--) {
      const idx = indices[i];
      if (idx === undefined || !isRemovableAnchor(idx, blocks, blockRoles)) continue;
      indices = indices.filter((v) => v !== idx);
      removed = true;
      break;
    }
    if (!removed) break;
  }

  while (indices.length < CHAPTER_JUMP_MIN) {
    const mid = findLongestGapEnd(blocks, indices);
    if (mid === null || indices.includes(mid)) break;
    indices.push(mid);
    indices.sort((a, b) => a - b);
  }

  return indices;
}

function chapterJumpLabel(
  block: CueBlock,
  speechTexts: readonly string[] | undefined,
  nonBodySectionStart: boolean,
): string {
  if (nonBodySectionStart) {
    const preview = speechTexts?.[block.index];
    const head = sectionHeading(block.section);
    if (preview?.trim()) return `${head} — ${speechPreview(preview, 48)}`;
    return head;
  }
  return chapterRowLabel(block, speechTexts);
}

/**
 * Baut 5–12 Sprungmarken: zuerst Abschnittsgrenzen (body/terms/example/faq/task),
 * dann Kernsätze und term/why-Anker im body; ohne Abschnittsmetadaten fallback
 * auf jeden Sprechblock.
 */
export function buildChapterJumps(
  cueSheet: CueSheet,
  speechTexts?: readonly string[],
  blockRoles?: readonly BlockRole[],
): ChapterJump[] {
  const blocks = cueSheet.blocks;
  if (blocks.length === 0) return [];

  if (!hasSectionJumpStructure(blocks)) {
    return blocks.map((block) => ({
      block,
      label: chapterRowLabel(block, speechTexts),
      sectionHeading: null,
    }));
  }

  const anchors = new Set<number>([0]);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;
    const prev = i > 0 ? blocks[i - 1] : undefined;
    if (isSectionStartAnchor(block, prev)) anchors.add(i);
    if (block.isKeySentence) anchors.add(i);
  }
  for (const idx of collectBodyRoleAnchors(blocks, blockRoles)) anchors.add(idx);

  const finalIndices = enforceJumpCount(blocks, [...anchors], blockRoles);

  return finalIndices.map((i) => {
    const block = blocks[i];
    if (!block) {
      throw new Error(`buildChapterJumps: fehlender Block an Index ${i}`);
    }
    const prev = i > 0 ? blocks[i - 1] : undefined;
    const nonBodyStart = isSectionStartAnchor(block, prev);
    return {
      block,
      label: chapterJumpLabel(block, speechTexts, nonBodyStart),
      sectionHeading: nonBodyStart ? sectionHeading(block.section) : null,
    };
  });
}

export function findActiveChapterJumpIndex(
  jumps: readonly ChapterJump[],
  currentBlockIndex: number | undefined,
): number {
  if (jumps.length === 0 || currentBlockIndex === undefined) return -1;
  for (let i = jumps.length - 1; i >= 0; i--) {
    const jump = jumps[i];
    if (jump && jump.block.index <= currentBlockIndex) return i;
  }
  return 0;
}
