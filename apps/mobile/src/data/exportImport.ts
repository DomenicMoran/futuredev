import type {
  BookmarkRow,
  CareerChecklistRow,
  Database,
  ExamResultRow,
  NoteRow,
  PortfolioItemRow,
  ProgressRow,
  PlaylistRow,
  PlaylistItemRow,
  ReviewRow,
  LegacyReviewArchiveRow,
  SettingRow,
} from './types.js';
import { EXPORT_VERSION } from './types.js';
import { getDatabase } from './db.js';

export interface ExportBundle {
  schemaVersion: number;
  progress: ProgressRow[];
  reviews: ReviewRow[];
  legacyReviewArchive: LegacyReviewArchiveRow[];
  notes: NoteRow[];
  bookmarks: BookmarkRow[];
  settings: SettingRow[];
  portfolio_items: PortfolioItemRow[];
  career_checklist: CareerChecklistRow[];
  exam_results: ExamResultRow[];
  playlists: PlaylistRow[];
  playlist_items: PlaylistItemRow[];
}

/** Baut das Export-JSON aus `datenmodell.md`, Abschnitt b, gegen eine beliebige {@link Database}. */
export async function exportAllFrom(db: Database): Promise<ExportBundle> {
  return db.transaction(async (snapshotDb) => {
  const [progress, reviews, legacyReviewArchive, notes, bookmarks, settings, portfolioItems, careerChecklist, examResults, playlists] =
    await Promise.all([
      snapshotDb.listProgress(),
      snapshotDb.listReviews(),
      snapshotDb.listLegacyReviewArchive(),
      snapshotDb.listNotes(),
      snapshotDb.listBookmarks(),
      snapshotDb.listSettings(),
      snapshotDb.listPortfolioItems(),
      snapshotDb.listCareerChecklist(),
      snapshotDb.listExamResults(),
      snapshotDb.listPlaylists(),
    ]);
  const playlistItems = (await Promise.all(playlists.map((p) => snapshotDb.listPlaylistItems(p.id)))).flat();
  return {
    schemaVersion: EXPORT_VERSION,
    progress,
    reviews,
    legacyReviewArchive,
    notes,
    bookmarks,
    settings,
    portfolio_items: portfolioItems,
    career_checklist: careerChecklist,
    exam_results: examResults,
    playlists,
    playlist_items: playlistItems,
  };
  });
}

export async function exportAll(): Promise<ExportBundle> {
  return exportAllFrom(await getDatabase());
}

function timestampOf(row: { updatedAt?: string; createdAt?: string; takenAt?: string; dueAt?: string }): number {
  const value = row.updatedAt ?? row.createdAt ?? row.takenAt ?? row.dueAt;
  return value ? Date.parse(value) : 0;
}

/**
 * Fuehrt eine Zeile mit der bereits gespeicherten zusammen: der Datensatz mit
 * dem neueren Zeitstempel gewinnt (datenmodell.md, Abschnitt b). Fehlt die
 * bestehende Zeile, gewinnt immer die importierte.
 */
function newerWins<T extends { updatedAt?: string; createdAt?: string; takenAt?: string; dueAt?: string }>(
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
  await db.transaction(async (transactionDb) => {

  const existingProgress = new Map((await transactionDb.listProgress()).map((r) => [r.lessonId, r]));
  for (const row of bundle.progress) {
    await transactionDb.upsertProgress(newerWins(existingProgress.get(row.lessonId), row));
  }

  const existingReviews = new Map((await transactionDb.listReviews()).map((r) => [`${r.sourceLessonId}\0${r.questionId}`, r]));
  for (const row of bundle.reviews) {
    // reviews hat keinen Zeitstempel zum Vergleichen; die importierte Zeile
    // gewinnt nur, wenn lokal noch nichts existiert (sonst zaehlt der
    // laufende lokale Wiederholungsstand mehr als ein alter Export).
    const key = `${row.sourceLessonId}\0${row.questionId}`;
    const existing = existingReviews.get(key);
    if (!existing || timestampOf(row) >= timestampOf(existing)) {
      await transactionDb.upsertReview(row);
    }
  }
  const existingArchiveIds = new Set((await transactionDb.listLegacyReviewArchive()).map((r) => r.id));
  for (const row of bundle.legacyReviewArchive) {
    if (!existingArchiveIds.has(row.id)) await transactionDb.upsertLegacyReviewArchive(row);
  }

  const existingNotes = new Map((await transactionDb.listNotes()).map((r) => [r.id, r]));
  for (const row of bundle.notes) {
    await transactionDb.upsertNote(newerWins(existingNotes.get(row.id), row));
  }

  const existingBookmarks = new Map((await transactionDb.listBookmarks()).map((r) => [r.id, r]));
  for (const row of bundle.bookmarks) {
    await transactionDb.upsertBookmark(newerWins(existingBookmarks.get(row.id), row));
  }

  const existingSettings = new Map((await transactionDb.listSettings()).map((r) => [r.key, r]));
  for (const row of bundle.settings) {
    if (!existingSettings.has(row.key)) {
      await transactionDb.setSetting(row.key, row.value);
    }
  }

  const existingPortfolio = new Map((await transactionDb.listPortfolioItems()).map((r) => [r.id, r]));
  for (const row of bundle.portfolio_items) {
    await transactionDb.upsertPortfolioItem(newerWins(existingPortfolio.get(row.id), row));
  }

  const existingChecklist = new Map((await transactionDb.listCareerChecklist()).map((r) => [r.item, r]));
  for (const row of bundle.career_checklist) {
    await transactionDb.upsertCareerChecklistItem(newerWins(existingChecklist.get(row.item), row));
  }

  const existingExamIds = new Set((await transactionDb.listExamResults()).map((r) => r.id));
  for (const row of bundle.exam_results) {
    if (!existingExamIds.has(row.id)) {
      await transactionDb.insertExamResult(row);
    }
  }
  const existingPlaylists = new Map((await transactionDb.listPlaylists()).map((row) => [row.id, row]));
  for (const row of bundle.playlists) {
    const existing = existingPlaylists.get(row.id);
    if (!existing || timestampOf(row) >= timestampOf(existing)) {
      await transactionDb.restorePlaylist(row, bundle.playlist_items.filter((item) => item.playlistId === row.id));
    }
  }
  });
}

export async function importAll(data: unknown): Promise<void> {
  await importAllInto(await getDatabase(), data);
}

export function parseExportBundle(data: unknown): ExportBundle {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Export-Datei ist kein Objekt');
  }
  const record = data as Record<string, unknown>;
  const version = record.schemaVersion;
  if (version !== 1 && version !== 2 && version !== 3 && version !== EXPORT_VERSION) throw new Error('Export-Datei: nicht unterstützte schemaVersion');
  const legacyArchives: LegacyReviewArchiveRow[] = [];
  if (version < EXPORT_VERSION) {
    const legacyReviews = record.reviews;
    if (!Array.isArray(legacyReviews)) throw new Error('Export-Datei: Feld "reviews" fehlt oder ist kein Array');
    const seenLegacyIds = new Set<string>();
    for (const entry of legacyReviews) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Export-Datei: ungültige Legacy-Review-Zeile');
      const row = entry as Record<string, unknown>;
      const id = typeof row.lessonId === 'string' ? row.lessonId : row.id;
      if (!str(id) || !int(row.leitnerStage) || row.leitnerStage < 1 || row.leitnerStage > 5 || !time(row.dueAt) || !int(row.errorCount)) {
        throw new Error('Export-Datei: ungültige Legacy-Review-Zeile');
      }
      if (seenLegacyIds.has(id)) throw new Error('Export-Datei: doppelter Schlüssel in Legacy-Reviews');
      seenLegacyIds.add(id);
      legacyArchives.push({
        id,
        leitnerStage: row.leitnerStage,
        dueAt: row.dueAt,
        errorCount: row.errorCount,
        archivedAt: new Date().toISOString(),
        reason: 'legacy-question-index-unknown',
      });
    }
  }
  const arrays = [
    'progress',
    'reviews',
    'notes',
    'bookmarks',
    'settings',
    'portfolio_items',
    'career_checklist',
    'exam_results', ...(version >= 3 ? ['playlists', 'playlist_items'] : []), ...(version === EXPORT_VERSION ? ['legacyReviewArchive'] : []),
  ] as const;
  for (const key of arrays) {
    if (!Array.isArray(record[key])) {
      throw new Error(`Export-Datei: Feld "${key}" fehlt oder ist kein Array`);
    }
  }
  const normalized: Record<string, unknown> = {
    ...record,
    reviews: version === EXPORT_VERSION ? record.reviews : [],
    playlists: version >= 3 ? record.playlists : [],
    playlist_items: version >= 3 ? record.playlist_items : [],
    legacyReviewArchive: version === EXPORT_VERSION ? record.legacyReviewArchive : legacyArchives,
  };
  const validators: Record<string, (r: Record<string, unknown>) => boolean> = {
    progress: r => str(r.lessonId) && typeof r.state === 'string' && ['new','started','read','listened','quiz_passed','completed'].includes(r.state) && nullableInt(r.readUntil) && nullableInt(r.listenedUntil) && nullableNum(r.quizScore) && (r.quizScore === null || (typeof r.quizScore === 'number' && r.quizScore >= 0 && r.quizScore <= 100)) && typeof r.quizPassed === 'boolean' && time(r.updatedAt),
    reviews: r => str(r.sourceLessonId) && str(r.questionId) && int(r.leitnerStage) && r.leitnerStage >= 1 && r.leitnerStage <= 5 && time(r.dueAt) && int(r.errorCount),
    legacyReviewArchive: r => str(r.id) && int(r.leitnerStage) && r.leitnerStage >= 1 && r.leitnerStage <= 5 && time(r.dueAt) && int(r.errorCount) && time(r.archivedAt) && r.reason === 'legacy-question-index-unknown',
    notes: r => str(r.id) && str(r.lessonId) && typeof r.body === 'string' && time(r.createdAt) && time(r.updatedAt),
    bookmarks: r => str(r.id) && str(r.lessonId) && int(r.position) && time(r.createdAt),
    settings: r => str(r.key) && typeof r.value === 'string',
    portfolio_items: r => str(r.id) && str(r.baustein) && typeof r.status === 'string' && ['offen','veroeffentlicht','erklaert'].includes(r.status) && (r.url === null || typeof r.url === 'string') && time(r.updatedAt),
    career_checklist: r => str(r.item) && typeof r.checked === 'boolean' && time(r.updatedAt),
    exam_results: r => str(r.id) && str(r.scope) && num(r.score) && r.score >= 0 && r.score <= 100 && typeof r.passed === 'boolean' && time(r.takenAt),
    playlists: r => str(r.id) && str(r.name) && time(r.createdAt) && time(r.updatedAt),
    playlist_items: r => str(r.playlistId) && str(r.lessonId) && int(r.position),
  };
  for (const key of arrays) {
    const rows = (normalized[key] ?? []) as unknown[];
    const validate = validators[key];
    if (!validate || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row) || !validate(row as Record<string, unknown>))) throw new Error(`Export-Datei: ungültige Zeile in "${key}"`);
  }
  if (arrays.reduce((sum, key) => sum + ((normalized[key] as unknown[]).length), 0) > 50_000) throw new Error('Export-Datei: zu viele Datensätze');
  const keyOf: Partial<Record<(typeof arrays)[number], (row: Record<string, unknown>) => string>> = {
    progress: r => String(r.lessonId), reviews: r => `${String(r.sourceLessonId)}\0${String(r.questionId)}`, legacyReviewArchive: r => String(r.id), notes: r => String(r.id), bookmarks: r => String(r.id), settings: r => String(r.key), portfolio_items: r => String(r.id), career_checklist: r => String(r.item), exam_results: r => String(r.id), playlists: r => String(r.id),
  };
  for (const table of arrays) {
    const getter = keyOf[table]; if (!getter) continue;
    const seen = new Set<string>();
    for (const row of normalized[table] as Record<string, unknown>[]) { const key = getter(row); if (seen.has(key)) throw new Error(`Export-Datei: doppelter Schlüssel in "${table}"`); seen.add(key); }
  }
  const playlistIds = new Set((normalized.playlists as PlaylistRow[]).map((row) => row.id));
  const playlistKeys = new Set<string>();
  const positionKeys = new Set<string>();
  for (const item of normalized.playlist_items as PlaylistItemRow[]) {
    const key = `${item.playlistId}\0${item.lessonId}`;
    const positionKey = `${item.playlistId}\0${item.position}`;
    if (!playlistIds.has(item.playlistId) || playlistKeys.has(key) || positionKeys.has(positionKey)) throw new Error('Export-Datei: ungültige Playlist-Zuordnung');
    playlistKeys.add(key);
    positionKeys.add(positionKey);
  }
  return normalized as unknown as ExportBundle;
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1_000_000;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown): v is number => num(v) && Number.isInteger(v) && v >= 0;
const nullableNum = (v: unknown): boolean => v === null || num(v);
const nullableInt = (v: unknown): boolean => v === null || int(v);
const time = (v: unknown): v is string => {
  if (!str(v)) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const offsetHour = Number(m[9] ?? 0);
  const offsetMinute = Number(m[10] ?? 0);
  if (![year, month, day, hour, minute, second, offsetHour, offsetMinute].every(Number.isFinite)) return false;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day && hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59;
};
