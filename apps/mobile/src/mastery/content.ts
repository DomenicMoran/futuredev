import { getContentFs } from '../content/contentFs.js';
import { loadContentSnapshot } from '../content/generation.js';
import { bundledManifest, getBundledLesson } from '../content/bundledData.js';
import { loadLesson } from '../content/lessonLoader.js';
import { makeBank } from './engine.js';
import type { QuizQuestionInput } from '@futuredev/core';

/** Reuse trusted, schema-validated bundled lessons only when the active digest matches.
 * Downloaded/changed lessons still use the pinned, verified file loader. */
export async function loadMasteryBank() {
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  const bundled = new Map(bundledManifest.lessons.map((l) => [l.id, l.sha256]));
  const questions: QuizQuestionInput[] = [];
  for (const entry of snapshot.manifest?.lessons ?? []) {
    const lesson =
      bundled.get(entry.id) === entry.sha256
        ? getBundledLesson(entry.id)
        : await loadLesson(fs, entry.id, { snapshot });
    if (!lesson)
      throw new Error(
        `Lektion ${entry.id} konnte nicht geladen werden. Bitte Inhalte erneut laden.`,
      );
    questions.push(...lesson.quiz.map((q) => ({ ...q, sourceLessonId: entry.id })));
  }
  return makeBank(questions);
}
