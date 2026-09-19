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
  lessonId: string;
  leitnerStage: number;
  dueAt: string;
  errorCount: number;
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

/** Aktuelle Version des Geraete-Schemas. Erhoehen, wenn sich eine Tabelle aendert. */
export const SCHEMA_VERSION = 1;

/**
 * Gemeinsame Schnittstelle fuer Geraetedaten. Eine SQLite-Implementierung
 * (`sqliteDatabase.ts`, echtes Geraet) und eine Speicher-Implementierung
 * (`memoryDatabase.ts`, Tests ohne natives SQLite) erfuellen dieselbe
 * Schnittstelle, damit Export/Import und alle Tabellenfunktionen gegen beide
 * funktionieren.
 */
export interface Database {
  init(): Promise<void>;
  getSchemaVersion(): Promise<number>;

  getProgress(lessonId: string): Promise<ProgressRow | undefined>;
  upsertProgress(row: ProgressRow): Promise<void>;
  listProgress(): Promise<ProgressRow[]>;

  getReview(lessonId: string): Promise<ReviewRow | undefined>;
  upsertReview(row: ReviewRow): Promise<void>;
  listReviews(): Promise<ReviewRow[]>;

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
}
