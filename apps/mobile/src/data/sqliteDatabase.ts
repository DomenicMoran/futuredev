import * as SQLite from 'expo-sqlite';
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

const DATABASE_NAME = 'futuredev.db';

// Migrationen mit Versionsnummer, wie in `settings.schema_version` hinterlegt
// (Technikvorgabe 3). Jede Migration ist idempotent (`create table if not
// exists`), damit ein zweiter Lauf nach einem Absturz nichts kaputt macht.
const MIGRATIONS: Record<number, string> = {
  1: `
    create table if not exists progress (
      lesson_id text primary key not null,
      state text not null,
      read_until integer,
      listened_until integer,
      quiz_score integer,
      quiz_passed integer not null default 0,
      updated_at text not null
    );
    create table if not exists reviews (
      lesson_id text primary key not null,
      leitner_stage integer not null,
      due_at text not null,
      error_count integer not null default 0
    );
    create table if not exists notes (
      id text primary key not null,
      lesson_id text not null,
      body text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists notes_lesson_id_idx on notes (lesson_id);
    create table if not exists bookmarks (
      id text primary key not null,
      lesson_id text not null,
      position integer not null,
      created_at text not null
    );
    create index if not exists bookmarks_lesson_id_idx on bookmarks (lesson_id);
    create table if not exists settings (
      key text primary key not null,
      value text not null
    );
    create table if not exists portfolio_items (
      id text primary key not null,
      baustein text not null,
      status text not null,
      url text,
      updated_at text not null
    );
    create table if not exists career_checklist (
      item text primary key not null,
      checked integer not null default 0,
      updated_at text not null
    );
    create table if not exists exam_results (
      id text primary key not null,
      scope text not null,
      score integer not null,
      passed integer not null default 0,
      taken_at text not null
    );
  `,
};

function toBool(value: number | null | undefined): boolean {
  return value === 1;
}
function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

/**
 * SQLite-Implementierung ueber `expo-sqlite` (async API, siehe
 * Technikvorgabe 3). Erfuellt dieselbe {@link Database}-Schnittstelle wie
 * `memoryDatabase.ts`.
 */
export function createSqliteDatabase(): Database {
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
    }
    return dbPromise;
  }

  async function runMigrations(): Promise<void> {
    const db = await getDb();
    await db.execAsync('pragma journal_mode = WAL;');
    const row = await db.getFirstAsync<{ value: string }>(
      "select value from settings where key = 'schema_version'",
    ).catch(() => undefined);
    // Erste Tabelle existiert eventuell noch nicht: `settings` wird in
    // Migration 1 angelegt, deshalb faengt currentVersion bei 0 an, wenn die
    // Abfrage selbst fehlschlaegt (Tabelle fehlt).
    const currentVersion = row ? Number(row.value) : 0;
    for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version += 1) {
      const statements = MIGRATIONS[version];
      if (!statements) continue;
      await db.execAsync(statements);
      await db.runAsync(
        'insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
        'schema_version',
        String(version),
      );
    }
  }

  return {
    async init() {
      await runMigrations();
    },

    async getSchemaVersion() {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>(
        "select value from settings where key = 'schema_version'",
      );
      return row ? Number(row.value) : 0;
    },

    async getProgress(lessonId) {
      const db = await getDb();
      const row = await db.getFirstAsync<{
        lesson_id: string;
        state: string;
        read_until: number | null;
        listened_until: number | null;
        quiz_score: number | null;
        quiz_passed: number;
        updated_at: string;
      }>('select * from progress where lesson_id = ?', lessonId);
      if (!row) return undefined;
      return {
        lessonId: row.lesson_id,
        state: row.state as ProgressRow['state'],
        readUntil: row.read_until,
        listenedUntil: row.listened_until,
        quizScore: row.quiz_score,
        quizPassed: toBool(row.quiz_passed),
        updatedAt: row.updated_at,
      };
    },
    async upsertProgress(rowValue) {
      const db = await getDb();
      await db.runAsync(
        `insert into progress (lesson_id, state, read_until, listened_until, quiz_score, quiz_passed, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict(lesson_id) do update set
           state = excluded.state, read_until = excluded.read_until,
           listened_until = excluded.listened_until, quiz_score = excluded.quiz_score,
           quiz_passed = excluded.quiz_passed, updated_at = excluded.updated_at`,
        rowValue.lessonId,
        rowValue.state,
        rowValue.readUntil,
        rowValue.listenedUntil,
        rowValue.quizScore,
        fromBool(rowValue.quizPassed),
        rowValue.updatedAt,
      );
    },
    async listProgress() {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        lesson_id: string;
        state: string;
        read_until: number | null;
        listened_until: number | null;
        quiz_score: number | null;
        quiz_passed: number;
        updated_at: string;
      }>('select * from progress');
      return rows.map((row) => ({
        lessonId: row.lesson_id,
        state: row.state as ProgressRow['state'],
        readUntil: row.read_until,
        listenedUntil: row.listened_until,
        quizScore: row.quiz_score,
        quizPassed: toBool(row.quiz_passed),
        updatedAt: row.updated_at,
      }));
    },

    async getReview(lessonId) {
      const db = await getDb();
      const row = await db.getFirstAsync<{
        lesson_id: string;
        leitner_stage: number;
        due_at: string;
        error_count: number;
      }>('select * from reviews where lesson_id = ?', lessonId);
      if (!row) return undefined;
      return {
        lessonId: row.lesson_id,
        leitnerStage: row.leitner_stage,
        dueAt: row.due_at,
        errorCount: row.error_count,
      };
    },
    async upsertReview(rowValue: ReviewRow) {
      const db = await getDb();
      await db.runAsync(
        `insert into reviews (lesson_id, leitner_stage, due_at, error_count) values (?, ?, ?, ?)
         on conflict(lesson_id) do update set
           leitner_stage = excluded.leitner_stage, due_at = excluded.due_at, error_count = excluded.error_count`,
        rowValue.lessonId,
        rowValue.leitnerStage,
        rowValue.dueAt,
        rowValue.errorCount,
      );
    },
    async listReviews() {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        lesson_id: string;
        leitner_stage: number;
        due_at: string;
        error_count: number;
      }>('select * from reviews');
      return rows.map((row) => ({
        lessonId: row.lesson_id,
        leitnerStage: row.leitner_stage,
        dueAt: row.due_at,
        errorCount: row.error_count,
      }));
    },

    async listNotes(lessonId) {
      const db = await getDb();
      const rows = lessonId
        ? await db.getAllAsync<NoteRowSql>('select * from notes where lesson_id = ? order by created_at desc', lessonId)
        : await db.getAllAsync<NoteRowSql>('select * from notes order by created_at desc');
      return rows.map(mapNoteRow);
    },
    async upsertNote(rowValue) {
      const db = await getDb();
      await db.runAsync(
        `insert into notes (id, lesson_id, body, created_at, updated_at) values (?, ?, ?, ?, ?)
         on conflict(id) do update set body = excluded.body, updated_at = excluded.updated_at`,
        rowValue.id,
        rowValue.lessonId,
        rowValue.body,
        rowValue.createdAt,
        rowValue.updatedAt,
      );
    },
    async deleteNote(id) {
      const db = await getDb();
      await db.runAsync('delete from notes where id = ?', id);
    },

    async listBookmarks(lessonId) {
      const db = await getDb();
      const rows = lessonId
        ? await db.getAllAsync<BookmarkRowSql>(
            'select * from bookmarks where lesson_id = ? order by position asc',
            lessonId,
          )
        : await db.getAllAsync<BookmarkRowSql>('select * from bookmarks order by created_at desc');
      return rows.map(mapBookmarkRow);
    },
    async upsertBookmark(rowValue) {
      const db = await getDb();
      await db.runAsync(
        `insert into bookmarks (id, lesson_id, position, created_at) values (?, ?, ?, ?)
         on conflict(id) do update set position = excluded.position`,
        rowValue.id,
        rowValue.lessonId,
        rowValue.position,
        rowValue.createdAt,
      );
    },
    async deleteBookmark(id) {
      const db = await getDb();
      await db.runAsync('delete from bookmarks where id = ?', id);
    },

    async getSetting(key) {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>('select value from settings where key = ?', key);
      return row?.value;
    },
    async setSetting(key, value) {
      const db = await getDb();
      await db.runAsync(
        'insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
        key,
        value,
      );
    },
    async listSettings() {
      const db = await getDb();
      return db.getAllAsync<SettingRow>('select key, value from settings');
    },

    async listPortfolioItems() {
      const db = await getDb();
      const rows = await db.getAllAsync<PortfolioItemRowSql>('select * from portfolio_items');
      return rows.map(mapPortfolioItemRow);
    },
    async upsertPortfolioItem(rowValue) {
      const db = await getDb();
      await db.runAsync(
        `insert into portfolio_items (id, baustein, status, url, updated_at) values (?, ?, ?, ?, ?)
         on conflict(id) do update set status = excluded.status, url = excluded.url, updated_at = excluded.updated_at`,
        rowValue.id,
        rowValue.baustein,
        rowValue.status,
        rowValue.url,
        rowValue.updatedAt,
      );
    },

    async listCareerChecklist() {
      const db = await getDb();
      const rows = await db.getAllAsync<{ item: string; checked: number; updated_at: string }>(
        'select * from career_checklist',
      );
      return rows.map((row): CareerChecklistRow => ({
        item: row.item,
        checked: toBool(row.checked),
        updatedAt: row.updated_at,
      }));
    },
    async upsertCareerChecklistItem(rowValue) {
      const db = await getDb();
      await db.runAsync(
        `insert into career_checklist (item, checked, updated_at) values (?, ?, ?)
         on conflict(item) do update set checked = excluded.checked, updated_at = excluded.updated_at`,
        rowValue.item,
        fromBool(rowValue.checked),
        rowValue.updatedAt,
      );
    },

    async listExamResults(scope) {
      const db = await getDb();
      const rows = scope
        ? await db.getAllAsync<ExamResultRowSql>('select * from exam_results where scope = ? order by taken_at desc', scope)
        : await db.getAllAsync<ExamResultRowSql>('select * from exam_results order by taken_at desc');
      return rows.map(mapExamResultRow);
    },
    async insertExamResult(rowValue) {
      const db = await getDb();
      await db.runAsync(
        'insert into exam_results (id, scope, score, passed, taken_at) values (?, ?, ?, ?, ?)',
        rowValue.id,
        rowValue.scope,
        rowValue.score,
        fromBool(rowValue.passed),
        rowValue.takenAt,
      );
    },
  };
}

interface NoteRowSql {
  id: string;
  lesson_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
function mapNoteRow(row: NoteRowSql): NoteRow {
  return { id: row.id, lessonId: row.lesson_id, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at };
}

interface BookmarkRowSql {
  id: string;
  lesson_id: string;
  position: number;
  created_at: string;
}
function mapBookmarkRow(row: BookmarkRowSql): BookmarkRow {
  return { id: row.id, lessonId: row.lesson_id, position: row.position, createdAt: row.created_at };
}

interface PortfolioItemRowSql {
  id: string;
  baustein: string;
  status: string;
  url: string | null;
  updated_at: string;
}
function mapPortfolioItemRow(row: PortfolioItemRowSql): PortfolioItemRow {
  return {
    id: row.id,
    baustein: row.baustein,
    status: row.status as PortfolioItemRow['status'],
    url: row.url,
    updatedAt: row.updated_at,
  };
}

interface ExamResultRowSql {
  id: string;
  scope: string;
  score: number;
  passed: number;
  taken_at: string;
}
function mapExamResultRow(row: ExamResultRowSql): ExamResultRow {
  return { id: row.id, scope: row.scope, score: row.score, passed: toBool(row.passed), takenAt: row.taken_at };
}
