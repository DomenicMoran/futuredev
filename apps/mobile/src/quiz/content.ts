// Inhaltszugriff für das Quiz: bindet an Agent B's `src/content/`
// (ContentProvider, lessonLoader), die zum Beginn dieses Auftrags noch nicht
// existierte. `getContentFs()` liefert dasselbe Dateisystem, das die
// ContentProvider-Erststart-Kopie (assets/content/bundled.generated.ts)
// befüllt hat.
import type { QuizQuestionInput } from '@futuredev/core';
import { getContentFs, loadLesson, loadLocalManifest } from '../content/index.js';

export async function loadLessonQuiz(lessonId: string): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const lesson = await loadLesson(fs, lessonId);
  if (!lesson) {
    throw new Error(`keine Quizfragen für Lektion ${lessonId} gefunden (Inhalt noch nicht veröffentlicht)`);
  }
  return lesson.quiz;
}

/** Alle Fragen eines Moduls (Lektionskennung beginnt mit der Modulkennung, etwa "M01"). */
export async function loadModuleQuiz(moduleId: string): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  const ids = (manifest?.lessons ?? []).map((l) => l.id).filter((id) => id.startsWith(moduleId));
  const all: QuizQuestionInput[] = [];
  for (const id of ids) {
    const lesson = await loadLesson(fs, id);
    if (lesson) all.push(...lesson.quiz);
  }
  return all;
}

export async function loadAllQuiz(): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  const all: QuizQuestionInput[] = [];
  for (const entry of manifest?.lessons ?? []) {
    const lesson = await loadLesson(fs, entry.id);
    if (lesson) all.push(...lesson.quiz);
  }
  return all;
}

export async function knownLessonIds(): Promise<string[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  return (manifest?.lessons ?? []).map((l) => l.id).sort();
}
