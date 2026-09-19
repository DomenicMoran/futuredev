import type {
  BookmarkRow,
  CareerChecklistRow,
  Database,
  ExamResultRow,
  NoteRow,
  PortfolioItemRow,
  ProgressRow,
  ReviewRow,
  SettingRow,
} from './types.js';
import { SCHEMA_VERSION } from './types.js';
import { getDatabase } from './db.js';

export interface ExportBundle {
  schemaVersion: number;
  progress: ProgressRow[];
  reviews: ReviewRow[];
  notes: NoteRow[];
  bookmarks: BookmarkRow[];
  settings: SettingRow[];
  portfolio_items: PortfolioItemRow[];
  career_checklist: CareerChecklistRow[];
  exam_results: ExamResultRow[];
}

/** Baut das Export-JSON aus `datenmodell.md`, Abschnitt b, gegen eine beliebige {@link Database}. */
export async function exportAllFrom(db: Database): Promise<ExportBundle> {
  const [progress, reviews, notes, bookmarks, settings, portfolioItems, careerChecklist, examResults] =
    await Promise.all([
      db.listProgress(),
      db.listReviews(),
      db.listNotes(),
      db.listBookmarks(),
      db.listSettings(),
      db.listPortfolioItems(),
      db.listCareerChecklist(),
      db.listExamResults(),
    ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    progress,
    reviews,
    notes,
    bookmarks,
    settings,
    portfolio_items: portfolioItems,
    career_checklist: careerChecklist,
    exam_results: examResults,
  };
}

export async function exportAll(): Promise<ExportBundle> {
  return exportAllFrom(await getDatabase());
}

function timestampOf(row: { updatedAt?: string; createdAt?: string; takenAt?: string }): string {
  return row.updatedAt ?? row.createdAt ?? row.takenAt ?? '1970-01-01T00:00:00.000Z';
}

/**
 * Fuehrt eine Zeile mit der bereits gespeicherten zusammen: der Datensatz mit
 * dem neueren Zeitstempel gewinnt (datenmodell.md, Abschnitt b). Fehlt die
 * bestehende Zeile, gewinnt immer die importierte.
 */
function newerWins<T extends { updatedAt?: string; createdAt?: string; takenAt?: string }>(
  existing: T | undefined,
  incoming: T,
): T {
  if (!existing) return incoming;
  return timestampOf(incoming) >= timestampOf(existing) ? incoming : existing;
}

/**
 * Liest ein Export-JSON ein und fuehrt es Zeile fuer Zeile mit dem
 * bestehenden Lernstand zusammen (nie ein blindes Ueberschreiben). Wirft bei
 * einer nicht lesbaren Struktur, statt teilweise zu schreiben.
 */
export async function importAllInto(db: Database, data: unknown): Promise<void> {
  const bundle = parseExportBundle(data);

  const existingProgress = new Map((await db.listProgress()).map((r) => [r.lessonId, r]));
  for (const row of bundle.progress) {
    await db.upsertProgress(newerWins(existingProgress.get(row.lessonId), row));
  }

  const existingReviews = new Map((await db.listReviews()).map((r) => [r.lessonId, r]));
  for (const row of bundle.reviews) {
    // reviews hat keinen Zeitstempel zum Vergleichen; die importierte Zeile
    // gewinnt nur, wenn lokal noch nichts existiert (sonst zaehlt der
    // laufende lokale Wiederholungsstand mehr als ein alter Export).
    if (!existingReviews.has(row.lessonId)) {
      await db.upsertReview(row);
    }
  }

  const existingNotes = new Map((await db.listNotes()).map((r) => [r.id, r]));
  for (const row of bundle.notes) {
    await db.upsertNote(newerWins(existingNotes.get(row.id), row));
  }

  const existingBookmarks = new Map((await db.listBookmarks()).map((r) => [r.id, r]));
  for (const row of bundle.bookmarks) {
    await db.upsertBookmark(newerWins(existingBookmarks.get(row.id), row));
  }

  const existingSettings = new Map((await db.listSettings()).map((r) => [r.key, r]));
  for (const row of bundle.settings) {
    if (!existingSettings.has(row.key)) {
      await db.setSetting(row.key, row.value);
    }
  }

  const existingPortfolio = new Map((await db.listPortfolioItems()).map((r) => [r.id, r]));
  for (const row of bundle.portfolio_items) {
    await db.upsertPortfolioItem(newerWins(existingPortfolio.get(row.id), row));
  }

  const existingChecklist = new Map((await db.listCareerChecklist()).map((r) => [r.item, r]));
  for (const row of bundle.career_checklist) {
    await db.upsertCareerChecklistItem(newerWins(existingChecklist.get(row.item), row));
  }

  const existingExamIds = new Set((await db.listExamResults()).map((r) => r.id));
  for (const row of bundle.exam_results) {
    if (!existingExamIds.has(row.id)) {
      await db.insertExamResult(row);
    }
  }
}

export async function importAll(data: unknown): Promise<void> {
  await importAllInto(await getDatabase(), data);
}

function parseExportBundle(data: unknown): ExportBundle {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Export-Datei ist kein Objekt');
  }
  const record = data as Record<string, unknown>;
  const arrays = [
    'progress',
    'reviews',
    'notes',
    'bookmarks',
    'settings',
    'portfolio_items',
    'career_checklist',
    'exam_results',
  ] as const;
  for (const key of arrays) {
    if (!Array.isArray(record[key])) {
      throw new Error(`Export-Datei: Feld "${key}" fehlt oder ist kein Array`);
    }
  }
  if (typeof record.schemaVersion !== 'number') {
    throw new Error('Export-Datei: schemaVersion fehlt');
  }
  return record as unknown as ExportBundle;
}
