import { EMPTY_LESSON_STATUS, type LessonStatus } from '../data/lessonStatus.js';
export interface ListeningLesson { id: string; title: string; durationMinutes: number; durationSeconds?: number }
export interface ListeningTarget { lesson: ListeningLesson; seconds: number; next: boolean }
export function resolveListeningContinuation(lessons: readonly ListeningLesson[], statuses: Record<string, LessonStatus>): ListeningTarget | null {
  if (!lessons.length) return null;
  const recent = lessons.filter(lesson => statuses[lesson.id]?.audioUpdatedAt).sort((a, b) => (statuses[b.id]?.audioUpdatedAt ?? '').localeCompare(statuses[a.id]?.audioUpdatedAt ?? ''))[0];
  if (!recent) { const first = lessons.find(lesson => !statuses[lesson.id]?.heard && !statuses[lesson.id]?.done); return first ? { lesson: first, seconds: 0, next: false } : null; }
  const status = statuses[recent.id] ?? EMPTY_LESSON_STATUS;
  const duration = status.hearing?.duration ?? recent.durationSeconds ?? recent.durationMinutes * 60;
  if (status.overrides.heard === false && duration > 0 && status.listenedUntil >= duration - 2 && !status.done) return { lesson: recent, seconds: 0, next: false };
  if (status.heard || status.done || (duration > 0 && status.listenedUntil >= duration - 2)) {
    const next = lessons.slice(lessons.indexOf(recent) + 1).find(lesson => !statuses[lesson.id]?.heard && !statuses[lesson.id]?.done);
    return next ? { lesson: next, seconds: Math.max(0, statuses[next.id]?.listenedUntil ?? 0), next: true } : null;
  }
  return { lesson: recent, seconds: Math.max(0, status.listenedUntil), next: false };
}

export function shouldResumeLiveListening(status: LessonStatus | undefined, position: number, duration: number, playing: boolean): boolean {
  return playing || (position < duration - 2 && !status?.heard && !status?.done);
}

export function remainingListeningMinutes(lesson: ListeningLesson, seconds: number, status?: LessonStatus): number {
  const duration = lesson.durationSeconds ?? status?.hearing?.duration ?? lesson.durationMinutes * 60;
  return Math.max(1, Math.ceil((duration - seconds) / 60));
}
