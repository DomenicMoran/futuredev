import { getDatabase } from './db.js';
import type { BookmarkRow } from './types.js';

export async function listBookmarks(lessonId?: string): Promise<BookmarkRow[]> {
  const db = await getDatabase();
  return db.listBookmarks(lessonId);
}

/** Setzt ein Lesezeichen auf einen Sprechblock (ein Lesezeichen je Block und Lektion). */
export async function toggleBookmark(lessonId: string, blockPosition: number): Promise<boolean> {
  const db = await getDatabase();
  const existing = (await db.listBookmarks(lessonId)).find((b) => b.position === blockPosition);
  if (existing) {
    await db.deleteBookmark(existing.id);
    return false;
  }
  await db.upsertBookmark({
    id: `${lessonId}-block-${blockPosition}`,
    lessonId,
    position: blockPosition,
    createdAt: new Date().toISOString(),
  });
  return true;
}
