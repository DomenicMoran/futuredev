import type { LeitnerCard } from '@futuredev/core';
import { getContentFs, loadLesson, loadLocalManifest } from '../content/index.js';
import { listProgress } from '../data/progress.js';
import { bundledManifest } from '../../assets/content/bundled.generated.js';
import type { FlashcardEntry } from './types.js';

function flashcardId(lessonId: string, term: string): string {
  return `${lessonId}::${term}`;
}

function moduleIdFromLessonId(lessonId: string): string {
  return lessonId.slice(0, 3);
}

/** Begriffe aus begonnenen/abgeschlossenen Lektionen, sonst alle veröffentlichten. */
export async function loadFlashcardDeck(moduleFilter?: string): Promise<FlashcardEntry[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  const lessonIds = (manifest?.lessons?.length ? manifest.lessons : bundledManifest.lessons).map((l) => l.id);
  const progress = await listProgress();
  const touched = new Set(
    progress.filter((row) => row.state !== 'new').map((row) => row.lessonId),
  );
  const preferTouched = touched.size > 0;
  const entries: FlashcardEntry[] = [];
  const seen = new Set<string>();

  for (const lessonId of lessonIds) {
    if (moduleFilter && moduleIdFromLessonId(lessonId) !== moduleFilter) continue;
    if (preferTouched && !touched.has(lessonId)) continue;
    const lesson = await loadLesson(fs, lessonId);
    if (!lesson?.terms?.length) continue;
    for (const { term, definition } of lesson.terms) {
      const id = flashcardId(lessonId, term);
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({ id, lessonId, term, definition });
    }
  }

  if (entries.length > 0 || !preferTouched) {
    return entries.sort((a, b) => a.term.localeCompare(b.term, 'de'));
  }

  for (const lessonId of lessonIds) {
    if (moduleFilter && moduleIdFromLessonId(lessonId) !== moduleFilter) continue;
    const lesson = await loadLesson(fs, lessonId);
    if (!lesson?.terms?.length) continue;
    for (const { term, definition } of lesson.terms) {
      const id = flashcardId(lessonId, term);
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({ id, lessonId, term, definition });
    }
  }
  return entries.sort((a, b) => a.term.localeCompare(b.term, 'de'));
}

export function leitnerCardId(entry: FlashcardEntry): string {
  return entry.id;
}

export type { LeitnerCard };
