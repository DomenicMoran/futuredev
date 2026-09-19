// Zustandsübergänge einer Lektion und Fortschritt je Modul.

export type LessonState = 'neu' | 'begonnen' | 'gelesen' | 'gehoert' | 'quiz_bestanden' | 'abgeschlossen';

const ALLOWED_TRANSITIONS: Record<LessonState, LessonState[]> = {
  neu: ['begonnen'],
  begonnen: ['gelesen', 'gehoert'],
  gelesen: ['gehoert', 'quiz_bestanden'],
  gehoert: ['gelesen', 'quiz_bestanden'],
  quiz_bestanden: ['abgeschlossen'],
  abgeschlossen: [],
};

export interface LessonProgress {
  lessonId: string;
  state: LessonState;
}

/**
 * Wendet einen Zustandsübergang an. Ein nicht erlaubter Übergang wird ignoriert
 * (Rückgabe des unveränderten Fortschritts), damit doppelte oder verspätete
 * Ereignisse (etwa "gehört" nach bereits "abgeschlossen") den Zustand nicht
 * zurückwerfen.
 */
export function transitionLesson(progress: LessonProgress, nextState: LessonState): LessonProgress {
  const allowed = ALLOWED_TRANSITIONS[progress.state];
  if (!allowed.includes(nextState)) {
    return progress;
  }
  return { ...progress, state: nextState };
}

export function createLessonProgress(lessonId: string): LessonProgress {
  return { lessonId, state: 'neu' };
}

export function isLessonComplete(progress: LessonProgress): boolean {
  return progress.state === 'abgeschlossen';
}

export interface ModuleProgress {
  moduleId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

/** Fasst den Fortschritt aller Lektionen eines Moduls zusammen. */
export function computeModuleProgress(moduleId: string, lessonProgresses: LessonProgress[]): ModuleProgress {
  const totalLessons = lessonProgresses.length;
  const completedLessons = lessonProgresses.filter(isLessonComplete).length;
  const percent = totalLessons === 0 ? 0 : (completedLessons / totalLessons) * 100;
  return { moduleId, totalLessons, completedLessons, percent };
}
