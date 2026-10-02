// Inhaltszugriff für das Quiz: bindet an Agent B's `src/content/`
// (ContentProvider, lessonLoader), die zum Beginn dieses Auftrags noch nicht
// existierte. `getContentFs()` liefert dasselbe Dateisystem, das die
// ContentProvider-Erststart-Kopie (assets/content/bundled.generated.ts)
// befüllt hat.
import type { QuizQuestionInput } from '@futuredev/core';
import { getContentFs, loadLesson } from '../content/index.js';
import { loadContentSnapshot } from '../content/generation.js';

export async function loadLessonQuiz(lessonId: string): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const lesson = await loadLesson(fs, lessonId);
  if (!lesson) {
    throw new Error(`keine Quizfragen für Lektion ${lessonId} gefunden (Inhalt noch nicht veröffentlicht)`);
  }
  return lesson.quiz.map((question) => {
    if (!question.questionId) throw new Error(`Quizfrage ohne stabile questionId in ${lessonId}`);
    return { ...question, sourceLessonId: lessonId };
  });
}

/** Alle Fragen eines Moduls (Lektionskennung beginnt mit der Modulkennung, etwa "M01"). */
export async function loadModuleQuiz(moduleId: string): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  const ids = (snapshot.manifest?.lessons ?? []).map((l) => l.id).filter((id) => id.startsWith(moduleId));
  const all: QuizQuestionInput[] = [];
  for (const id of ids) {
    const lesson = await loadLesson(fs, id, { snapshot });
    if (!lesson) throw new Error(`Lektion ${id} ist im gepinnten Inhaltsstand beschädigt oder nicht verfügbar`);
    all.push(...lesson.quiz.map((question) => {
      if (!question.questionId) throw new Error(`Quizfrage ohne stabile questionId in ${id}`);
      return { ...question, sourceLessonId: id };
    }));
  }
  return all;
}

export async function loadAllQuiz(): Promise<QuizQuestionInput[]> {
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  const all: QuizQuestionInput[] = [];
  for (const entry of snapshot.manifest?.lessons ?? []) {
    const lesson = await loadLesson(fs, entry.id, { snapshot });
    if (!lesson) throw new Error(`Lektion ${entry.id} ist im gepinnten Inhaltsstand beschädigt oder nicht verfügbar`);
    all.push(...lesson.quiz.map((question) => {
      if (!question.questionId) throw new Error(`Quizfrage ohne stabile questionId in ${entry.id}`);
      return { ...question, sourceLessonId: entry.id };
    }));
  }
  return all;
}

export async function knownLessonIds(): Promise<string[]> {
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  return (snapshot.manifest?.lessons ?? []).map((l) => l.id).sort();
}
