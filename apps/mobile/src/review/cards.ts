// Lädt die Leitner-Karten aus der Tabelle `reviews` (Agent B's `src/data/`).
import type { LeitnerBox, LeitnerCard } from '@futuredev/core';
import { getDatabase } from '../data/db.js';

export async function loadReviewCards(): Promise<LeitnerCard[]> {
  const db = await getDatabase();
  const rows = await db.listReviews();
  return rows.map((row) => ({
    id: reviewCardKey(row.sourceLessonId, row.questionId),
    box: (row.leitnerStage || 1) as LeitnerBox,
    dueAt: row.dueAt,
    errorCount: row.errorCount,
  }));
}

export async function loadLegacyReviewArchive() {
  const db = await getDatabase();
  return db.listLegacyReviewArchive();
}

export function reviewCardKey(sourceLessonId: string, questionId: string): string {
  return `review:${encodeURIComponent(sourceLessonId)}:${encodeURIComponent(questionId)}`;
}

export function parseReviewCardKey(id: string): { sourceLessonId: string; questionId: string } | null {
  const match = /^review:([^:]+):(.+)$/.exec(id);
  if (!match?.[1] || !match[2]) return null;
  try {
    return { sourceLessonId: decodeURIComponent(match[1]), questionId: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}
