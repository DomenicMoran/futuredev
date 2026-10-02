import { de } from '../i18n/de.js';

/** Module list uses the lesson id when lesson JSON title is not hydrated yet. */
export function isHydratingLessonTitle(title: string, lessonId: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length === 0) return true;
  return trimmed === lessonId;
}

export function resolvePublishedLessonDisplayTitle(
  title: string | undefined | null,
  lessonId: string,
  fallback: string = de.start.lessonTitleFallback,
): string {
  if (title != null && !isHydratingLessonTitle(title, lessonId)) return title;
  return fallback;
}

/** Due review count is only known after Start data loaded successfully. */export type DailyRationDueState =
  | { kind: 'unknown' }
  | { kind: 'loaded'; dueReviewCount: number };

export function resolveDailyRationDueState(
  displayData: { dueReviewCount: number } | null,
): DailyRationDueState {
  if (displayData === null) return { kind: 'unknown' };
  return { kind: 'loaded', dueReviewCount: displayData.dueReviewCount };
}

export function formatDailyRationTileBody(state: DailyRationDueState): string {
  if (state.kind === 'unknown') return de.start.dailyRationTileUnavailable;
  if (state.dueReviewCount > 0) return de.start.dailyRationTileBody(state.dueReviewCount);
  return de.start.dailyRationTileEmpty;
}
