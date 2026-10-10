import type { DownloadState } from './types.js';

export function reconcileDownloadedUiState(
  current: Readonly<Record<string, boolean>>,
  lessonId: string,
  persisted: boolean,
): Record<string, boolean> {
  if (persisted) return { ...current, [lessonId]: true };
  const next: Record<string, boolean> = {};
  for (const [id, isPresent] of Object.entries(current)) if (id !== lessonId) next[id] = isPresent;
  return next;
}

/** Progress percentages do not change availability; preserve identity for React's bailout. */
export function reconcileDownloadAvailability(
  current: Record<string, boolean>,
  downloads: Readonly<Record<string, Pick<DownloadState, 'status'>>>,
): Record<string, boolean> {
  let next = current;
  for (const [id, item] of Object.entries(downloads)) {
    const available = item.status === 'downloaded';
    if ((current[id] ?? false) === available) continue;
    if (next === current) next = { ...current };
    next[id] = available;
  }
  return next;
}
