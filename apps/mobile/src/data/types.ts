import type { LessonState } from '@futuredev/core';

// Zeilenformen fuer alle acht Geraete-Tabellen aus
// 10_Projekte/FutureDev/Wissen/datenmodell.md, Abschnitt b. Zeitstempel sind
// immer ISO-Strings (kein SQLite-eigener Datumstyp), damit MemoryDatabase und
// SqliteDatabase dieselben Werte liefern.

export interface ProgressRow {
  lessonId: string;
  state: LessonState;
  readUntil: number | null;
  listenedUntil: number | null;
  quizScore: number | null;
  quizPassed: boolean;
  updatedAt: string;
}

export interface ReviewRow {
  sourceLessonId: string;
  questionId: string;
  leitnerStage: number;
  dueAt: string;
  errorCount: number;
}

/** Lossless archive of legacy lesson#qN cards; never auto-map unknown indices. */
export interface LegacyReviewArchiveRow {
  id: string;
  leitnerStage: number;
  dueAt: string;
  errorCount: number;
  archivedAt: string;
  reason: 'legacy-question-index-unknown';
}

export interface NoteRow {
  id: string;
  lessonId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRow {
  id: string;
  lessonId: string;
  position: number;
  createdAt: string;
}

export interface SettingRow {
  key: string;
  value: string;
}

export type PortfolioItemStatus = 'offen' | 'veroeffentlicht' | 'erklaert';

export interface PortfolioItemRow {
  id: string;
  baustein: string; // P00 bis P07
  status: PortfolioItemStatus;
  url: string | null;
  updatedAt: string;
}

export interface CareerChecklistRow {
  item: string;
  checked: boolean;
  updatedAt: string;
}

export interface ExamResultRow {
  id: string;
  scope: string; // Modulkennung oder "gesamt"
  score: number;
  passed: boolean;
  takenAt: string;
}

export interface PlaylistRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItemRow {
  playlistId: string;
  lessonId: string;
  position: number;
}

/** Aktuelle Version des Geraete-Schemas. Erhoehen, wenn sich eine Tabelle aendert. */
export const SCHEMA_VERSION = 3;
/** Version of the portable backup document, intentionally independent of SQLite migrations. */
export const EXPORT_VERSION = 4;

/** Fixed local personal-data tables used by the atomic Settings reset. */
export const PERSONAL_DATA_TABLES = [
  'progress', 'reviews', 'legacy_review_archive', 'notes', 'bookmarks', 'settings', 'portfolio_items',
  'career_checklist', 'exam_results', 'playlist_items', 'playlists',
] as const;

/**
 * Gemeinsame Schnittstelle fuer Geraetedaten. Eine SQLite-Implementierung
 * (`sqliteDatabase.ts`, echtes Geraet) und eine Speicher-Implementierung
 * (`memoryDatabase.ts`, Tests ohne natives SQLite) erfuellen dieselbe
 * Schnittstelle, damit Export/Import und alle Tabellenfunktionen gegen beide
 * funktionieren.
 */
export interface Database {
  /** Nested calls JOIN the current transaction (no savepoints); rollback occurs only if an error escapes the outermost callback. */
  transaction<T>(work: (transactionDb: Database) => Promise<T>): Promise<T>;
  clearPersonalData(): Promise<void>;
  init(): Promise<void>;
  getSchemaVersion(): Promise<number>;

  getProgress(lessonId: string): Promise<ProgressRow | undefined>;
  upsertProgress(row: ProgressRow): Promise<void>;
  listProgress(): Promise<ProgressRow[]>;

  getReview(sourceLessonId: string, questionId: string): Promise<ReviewRow | undefined>;
  upsertReview(row: ReviewRow): Promise<void>;
  listReviews(): Promise<ReviewRow[]>;
  listLegacyReviewArchive(): Promise<LegacyReviewArchiveRow[]>;
  upsertLegacyReviewArchive(row: LegacyReviewArchiveRow): Promise<void>;

  listNotes(lessonId?: string): Promise<NoteRow[]>;
  upsertNote(row: NoteRow): Promise<void>;
  deleteNote(id: string): Promise<void>;

  listBookmarks(lessonId?: string): Promise<BookmarkRow[]>;
  upsertBookmark(row: BookmarkRow): Promise<void>;
  deleteBookmark(id: string): Promise<void>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  listSettings(): Promise<SettingRow[]>;

  listPortfolioItems(): Promise<PortfolioItemRow[]>;
  upsertPortfolioItem(row: PortfolioItemRow): Promise<void>;

  listCareerChecklist(): Promise<CareerChecklistRow[]>;
  upsertCareerChecklistItem(row: CareerChecklistRow): Promise<void>;

  listExamResults(scope?: string): Promise<ExamResultRow[]>;
  insertExamResult(row: ExamResultRow): Promise<void>;

  listPlaylists(): Promise<PlaylistRow[]>;
  createPlaylist(name: string): Promise<PlaylistRow>;
  restorePlaylist(row: PlaylistRow, items: PlaylistItemRow[]): Promise<void>;
  renamePlaylist(id: string, name: string): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  listPlaylistItems(playlistId: string): Promise<PlaylistItemRow[]>;
  addPlaylistItem(playlistId: string, lessonId: string): Promise<void>;
  removePlaylistItem(playlistId: string, lessonId: string): Promise<void>;
}
