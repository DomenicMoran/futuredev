// Lädt die Leitner-Karten aus der Tabelle `reviews` (Agent B's `src/data/`).
import type { LeitnerBox, LeitnerCard } from '@futuredev/core';
import { getDatabase } from '../data/db.js';

export async function loadReviewCards(): Promise<LeitnerCard[]> {
  const db = await getDatabase();
  const rows = await db.listReviews();
  return rows.map((row) => ({
    id: row.lessonId,
    box: (row.leitnerStage || 1) as LeitnerBox,
    dueAt: row.dueAt,
    errorCount: row.errorCount,
  }));
}
