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
