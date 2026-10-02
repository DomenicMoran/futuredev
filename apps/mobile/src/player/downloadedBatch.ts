import type { ContentSnapshot } from '../content/generation.js';

/** Validates many download markers against the same content generation. */
export async function downloadedLessonIds(
  lessonIds: readonly string[],
  snapshot: ContentSnapshot,
  isDownloaded: (lessonId: string, snapshot: ContentSnapshot) => Promise<boolean>,
): Promise<Set<string>> {
  const states = await Promise.all(lessonIds.map((id) => isDownloaded(id, snapshot).catch(() => false)));
  return new Set(lessonIds.filter((_, index) => states[index]));
}
