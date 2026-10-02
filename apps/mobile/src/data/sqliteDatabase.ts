import * as SQLite from 'expo-sqlite';
import type {
  BookmarkRow,
  CareerChecklistRow,
  Database,
  ExamResultRow,
  NoteRow,
  PlaylistItemRow,
  PlaylistRow,
  PortfolioItemRow,
  ProgressRow,
  ReviewRow,
  LegacyReviewArchiveRow,
  SettingRow,
} from './types.js';
import { PERSONAL_DATA_TABLES, SCHEMA_VERSION } from './types.js';
import { runSerialized } from './serialQueue.js';

const DATABASE_NAME = 'futuredev.db';

async function serialDb<T>(work: () => Promise<T>): Promise<T> {
  return runSerialized(work);
}

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
  2: `
    create table if not exists playlists (
      id text primary key not null,
      name text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists playlist_items (
      playlist_id text not null,
      lesson_id text not null,
      position integer not null,
      primary key (playlist_id, lesson_id),
      foreign key (playlist_id) references playlists(id) on delete cascade
    );
    create index if not exists playlist_items_playlist_id_idx on playlist_items (playlist_id);
  `,
};

async function migrateReviewIdentity(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('pragma table_info(reviews)');
  const hasStableKeys = columns.some((column) => column.name === 'source_lesson_id');
  await db.execAsync(`
    create table if not exists legacy_review_archive (
      id text primary key not null,
      leitner_stage integer not null,
      due_at text not null,
      error_count integer not null default 0,
      archived_at text not null,
      reason text not null
    );
  `);
  if (hasStableKeys) return;
  const legacyRows = await db.getAllAsync<{ lesson_id: string; leitner_stage: number; due_at: string; error_count: number }>(
    'select lesson_id, leitner_stage, due_at, error_count from reviews',
  );
  const archivedRows = await db.getAllAsync<{ id: string; leitner_stage: number; due_at: string; error_count: number }>(
    'select id, leitner_stage, due_at, error_count from legacy_review_archive',
  );
  const archivedById = new Map(archivedRows.map((row) => [row.id, row]));
  for (const row of legacyRows) {
    const archived = archivedById.get(row.lesson_id);
    if (archived && (archived.leitner_stage !== row.leitner_stage || archived.due_at !== row.due_at || archived.error_count !== row.error_count)) {
      throw new Error(`Legacy review archive collision for ${row.lesson_id}`);
    }
  }
  await db.execAsync(`
    alter table reviews rename to reviews_legacy_v2;
    create table reviews (
      source_lesson_id text not null,
      question_id text not null,
      leitner_stage integer not null,
      due_at text not null,
      error_count integer not null default 0,
      primary key (source_lesson_id, question_id)
    );
  `);
  for (const row of legacyRows) {
    await db.runAsync(
      `insert into legacy_review_archive (id, leitner_stage, due_at, error_count, archived_at, reason)
       values (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'legacy-question-index-unknown')
       on conflict(id) do nothing`,
      row.lesson_id, row.leitner_stage, row.due_at, row.error_count,
    );
  }
  const finalArchive = await db.getAllAsync<{ id: string }>('select id from legacy_review_archive');
  const finalIds = new Set(finalArchive.map((row) => row.id));
  if (legacyRows.some((row) => !finalIds.has(row.lesson_id))) throw new Error('Legacy review archive verification failed');
  await db.execAsync('drop table reviews_legacy_v2');
}

function toBool(value: number | null | undefined): boolean {
  return value === 1;
}
function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

function isMissingPlaylistsTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table:\s*playlists/i.test(msg);
}

function isMissingBookmarksTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table:\s*bookmarks/i.test(msg);
}

async function repairBookmarkTables(db: SQLite.SQLiteDatabase): Promise<void> {
  const statements = MIGRATIONS[1];
  if (!statements) return;
  await db.execAsync(statements);
  const columns = await db
    .getAllAsync<{ name: string }>('pragma table_info(bookmarks)')
    .catch(() => [] as { name: string }[]);
  const names = new Set(columns.map((c) => c.name));
  const required = ['id', 'lesson_id', 'position', 'created_at'];
  if (required.some((col) => !names.has(col))) {
    await db.execAsync('drop table if exists bookmarks');
    await db.execAsync(`
      create table if not exists bookmarks (
        id text primary key not null,
        lesson_id text not null,
        position integer not null,
        created_at text not null
      );
      create index if not exists bookmarks_lesson_id_idx on bookmarks (lesson_id);
    `);
  }
}

async function repairPlaylistTables(db: SQLite.SQLiteDatabase): Promise<void> {
  const statements = MIGRATIONS[2];
  if (!statements) return;
  await db.execAsync(statements);
  await db.runAsync(
    `insert into settings (key, value) values (?, ?) on conflict(key) do update set value = case when cast(settings.value as integer) < 2 then excluded.value else settings.value end`,
    'schema_version',
    '2',
  );
}

/**
 * SQLite-Implementierung ueber `expo-sqlite` (async API, siehe
 * Technikvorgabe 3). Erfuellt dieselbe {@link Database}-Schnittstelle wie
 * `memoryDatabase.ts`.
 */
export function createSqliteDatabase(databaseOverride?: SQLite.SQLiteDatabase): Database {
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = databaseOverride ? Promise.resolve(databaseOverride) : null;
  const transactionScoped = databaseOverride !== undefined;

  async function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
    }
    return dbPromise;
  }

  async function withDb<T>(work: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    if (transactionScoped) return work(await getDb());
    return serialDb(async () => work(await getDb()));
  }

  async function withPlaylistTable<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (!isMissingPlaylistsTable(err)) throw err;
      await withDb(async (db) => {
        await repairPlaylistTables(db);
      });
      return run();
    }
  }

  async function withPlaylistWrite<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await withPlaylistTable(run);
    } catch (err) {
      if (!isMissingPlaylistsTable(err)) throw err;
      await withDb(async (db) => {
        await repairPlaylistTables(db);
      });
      return withPlaylistTable(run);
    }
  }

  async function withBookmarkTable<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (!isMissingBookmarksTable(err)) throw err;
      await withDb(async (db) => {
        await repairBookmarkTables(db);
      });
      return run();
    }
  }

  async function runMigrations(): Promise<void> {
    await withDb(async (db) => {
      await db.execAsync('pragma journal_mode = WAL;');
      const row = await db.getFirstAsync<{ value: string }>(
        "select value from settings where key = 'schema_version'",
      ).catch(() => undefined);
      const currentVersion = row ? Number(row.value) : 0;
      for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version += 1) {
        const statements = MIGRATIONS[version];
        if (version === 3) {
          await db.withExclusiveTransactionAsync(async (transactionDb) => {
            await migrateReviewIdentity(transactionDb);
            await transactionDb.runAsync(
              'insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
              'schema_version', String(version),
            );
          });
          continue;
        } else if (statements) {
          await db.execAsync(statements);
        } else continue;
        await db.runAsync(
          'insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
          'schema_version',
          String(version),
        );
      }
    });
  }

  return {
    async clearPersonalData() {
      await withDb(async (db) => {
        for (const table of PERSONAL_DATA_TABLES) await db.runAsync(`DELETE FROM ${table}`);
      });
    },
    async transaction(work) {
      if (transactionScoped) return work(createSqliteDatabase(await getDb()));
      let result!: Awaited<ReturnType<typeof work>>;
      await serialDb(async () => {
        const db = await getDb();
        await db.withExclusiveTransactionAsync(async (transactionDb) => {
          result = await work(createSqliteDatabase(transactionDb));
        });
      });
      return result;
    },
    async init() {
      await runMigrations();
      await withDb(async (db) => {
        await repairBookmarkTables(db);
        await repairPlaylistTables(db);
      });
    },

    async getSchemaVersion() {
      return withDb(async (db) => {
        const row = await db.getFirstAsync<{ value: string }>("select value from settings where key = 'schema_version'");
        return row ? Number(row.value) : 0;
      });
    },

    async getProgress(lessonId) {
      return withDb(async (db) => {
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
      });
    },
    async upsertProgress(rowValue) {
      await withDb(async (db) => {
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
      });
    },
    async listProgress() {
      return withDb(async (db) => {
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
      });
    },

    async getReview(sourceLessonId, questionId) {
      return withDb(async (db) => {
      const row = await db.getFirstAsync<{
        source_lesson_id: string;
        question_id: string;
        leitner_stage: number;
        due_at: string;
        error_count: number;
      }>('select * from reviews where source_lesson_id = ? and question_id = ?', sourceLessonId, questionId);
      if (!row) return undefined;
      return {
        sourceLessonId: row.source_lesson_id,
        questionId: row.question_id,
        leitnerStage: row.leitner_stage,
        dueAt: row.due_at,
        errorCount: row.error_count,
      };
      });
    },
    async upsertReview(rowValue: ReviewRow) {
      await withDb(async (db) => {
      await db.runAsync(
        `insert into reviews (source_lesson_id, question_id, leitner_stage, due_at, error_count) values (?, ?, ?, ?, ?)
         on conflict(source_lesson_id, question_id) do update set
           leitner_stage = excluded.leitner_stage, due_at = excluded.due_at, error_count = excluded.error_count`,
        rowValue.sourceLessonId,
        rowValue.questionId,
        rowValue.leitnerStage,
        rowValue.dueAt,
        rowValue.errorCount,
      );
      });
    },
    async listReviews() {
      return withDb(async (db) => {
      const rows = await db.getAllAsync<{
        source_lesson_id: string;
        question_id: string;
        leitner_stage: number;
        due_at: string;
        error_count: number;
      }>('select * from reviews');
      return rows.map((row) => ({
        sourceLessonId: row.source_lesson_id,
        questionId: row.question_id,
        leitnerStage: row.leitner_stage,
        dueAt: row.due_at,
        errorCount: row.error_count,
      }));
      });
    },
    async listLegacyReviewArchive() {
      return withDb(async (db) => db.getAllAsync<{
        id: string; leitner_stage: number; due_at: string; error_count: number; archived_at: string; reason: LegacyReviewArchiveRow['reason'];
      }>('select * from legacy_review_archive').then((rows) => rows.map((row) => ({
        id: row.id, leitnerStage: row.leitner_stage, dueAt: row.due_at, errorCount: row.error_count,
        archivedAt: row.archived_at, reason: row.reason,
      }))));
    },
    async upsertLegacyReviewArchive(row) {
      await withDb(async (db) => { await db.runAsync(
        `insert or ignore into legacy_review_archive (id, leitner_stage, due_at, error_count, archived_at, reason) values (?, ?, ?, ?, ?, ?)`,
        row.id, row.leitnerStage, row.dueAt, row.errorCount, row.archivedAt, row.reason,
      ); });
    },

    async listNotes(lessonId) {
      return withDb(async (db) => {
      const rows = lessonId
        ? await db.getAllAsync<NoteRowSql>('select * from notes where lesson_id = ? order by created_at desc', lessonId)
        : await db.getAllAsync<NoteRowSql>('select * from notes order by created_at desc');
      return rows.map(mapNoteRow);
      });
    },
    async upsertNote(rowValue) {
      await withDb(async (db) => {
      await db.runAsync(
        `insert into notes (id, lesson_id, body, created_at, updated_at) values (?, ?, ?, ?, ?)
         on conflict(id) do update set body = excluded.body, updated_at = excluded.updated_at`,
        rowValue.id,
        rowValue.lessonId,
        rowValue.body,
        rowValue.createdAt,
        rowValue.updatedAt,
      );
      });
    },
    async deleteNote(id) {
      await withDb((db) => db.runAsync('delete from notes where id = ?', id).then(() => undefined));
    },

    async listBookmarks(lessonId) {
      return withBookmarkTable(async () =>
        withDb(async (db) => {
          const rows = lessonId
            ? await db.getAllAsync<BookmarkRowSql>(
                'select * from bookmarks where lesson_id = ? order by position asc',
                lessonId,
              )
            : await db.getAllAsync<BookmarkRowSql>('select * from bookmarks order by created_at desc');
          return rows.map(mapBookmarkRow);
        }),
      );
    },
    async upsertBookmark(rowValue) {
      return withBookmarkTable(async () =>
        withDb(async (db) => {
          await db.runAsync(
            `insert or replace into bookmarks (id, lesson_id, position, created_at) values (?, ?, ?, ?)`,
            rowValue.id,
            rowValue.lessonId,
            rowValue.position,
            rowValue.createdAt,
          );
        }),
      );
    },
    async deleteBookmark(id) {
      return withBookmarkTable(async () => {
        await withDb(async (db) => {
          await db.runAsync('delete from bookmarks where id = ?', id);
        });
      });
    },

    async getSetting(key) {
      return withDb(async (db) => {
        const row = await db.getFirstAsync<{ value: string }>('select value from settings where key = ?', key);
        return row?.value;
      });
    },
    async setSetting(key, value) {
      await withDb(async (db) => {
        await db.runAsync(
          'insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
          key,
          value,
        );
      });
    },
    async listSettings() {
      return withDb((db) => db.getAllAsync<SettingRow>('select key, value from settings'));
    },

    async listPortfolioItems() {
      return withDb(async (db) => {
      const rows = await db.getAllAsync<PortfolioItemRowSql>('select * from portfolio_items');
      return rows.map(mapPortfolioItemRow);
      });
    },
    async upsertPortfolioItem(rowValue) {
      await withDb(async (db) => {
      await db.runAsync(
        `insert into portfolio_items (id, baustein, status, url, updated_at) values (?, ?, ?, ?, ?)
         on conflict(id) do update set status = excluded.status, url = excluded.url, updated_at = excluded.updated_at`,
        rowValue.id,
        rowValue.baustein,
        rowValue.status,
        rowValue.url,
        rowValue.updatedAt,
      );
      });
    },

    async listCareerChecklist() {
      return withDb(async (db) => {
      const rows = await db.getAllAsync<{ item: string; checked: number; updated_at: string }>(
        'select * from career_checklist',
      );
      return rows.map((row): CareerChecklistRow => ({
        item: row.item,
        checked: toBool(row.checked),
        updatedAt: row.updated_at,
      }));
      });
    },
    async upsertCareerChecklistItem(rowValue) {
      await withDb(async (db) => {
      await db.runAsync(
        `insert into career_checklist (item, checked, updated_at) values (?, ?, ?)
         on conflict(item) do update set checked = excluded.checked, updated_at = excluded.updated_at`,
        rowValue.item,
        fromBool(rowValue.checked),
        rowValue.updatedAt,
      );
      });
    },

    async listExamResults(scope) {
      return withDb(async (db) => {
      const rows = scope
        ? await db.getAllAsync<ExamResultRowSql>('select * from exam_results where scope = ? order by taken_at desc', scope)
        : await db.getAllAsync<ExamResultRowSql>('select * from exam_results order by taken_at desc');
      return rows.map(mapExamResultRow);
      });
    },
    async insertExamResult(rowValue) {
      await withDb(async (db) => {
      await db.runAsync(
        'insert into exam_results (id, scope, score, passed, taken_at) values (?, ?, ?, ?, ?)',
        rowValue.id,
        rowValue.scope,
        rowValue.score,
        fromBool(rowValue.passed),
        rowValue.takenAt,
      );
      });
    },

    async listPlaylists() {
      return withPlaylistTable(async () =>
        withDb(async (db) => {
          const rows = await db.getAllAsync<{ id: string; name: string; created_at: string; updated_at: string }>(
            'select * from playlists order by updated_at desc',
          );
          return rows.map(
            (row): PlaylistRow => ({
              id: row.id,
              name: row.name,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }),
          );
        }),
      );
    },
    async createPlaylist(name) {
      return withPlaylistWrite(async () =>
        withDb(async (db) => {
          const now = new Date().toISOString();
          const id = `pl_${now.replace(/[:.]/g, '')}_${Math.random().toString(36).slice(2, 8)}`;
          await db.runAsync(
            'insert into playlists (id, name, created_at, updated_at) values (?, ?, ?, ?)',
            id,
            name,
            now,
            now,
          );
          return { id, name, createdAt: now, updatedAt: now };
        }),
      );
    },
    async restorePlaylist(rowValue, items) {
      return withPlaylistWrite(async () => withDb(async (db) => {
        await db.runAsync('insert or replace into playlists (id, name, created_at, updated_at) values (?, ?, ?, ?)', rowValue.id, rowValue.name, rowValue.createdAt, rowValue.updatedAt);
        await db.runAsync('delete from playlist_items where playlist_id = ?', rowValue.id);
        for (const item of items) await db.runAsync('insert into playlist_items (playlist_id, lesson_id, position) values (?, ?, ?)', item.playlistId, item.lessonId, item.position);
      }));
    },
    async renamePlaylist(id, name) {
      return withPlaylistWrite(async () =>
        withDb(async (db) => {
          const now = new Date().toISOString();
          await db.runAsync('update playlists set name = ?, updated_at = ? where id = ?', name, now, id);
        }),
      );
    },
    async deletePlaylist(id) {
      return withPlaylistWrite(async () =>
        withDb(async (db) => {
          await db.runAsync('delete from playlist_items where playlist_id = ?', id);
          await db.runAsync('delete from playlists where id = ?', id);
        }),
      );
    },
    async listPlaylistItems(playlistId) {
      return withPlaylistTable(async () =>
        withDb(async (db) => {
          const rows = await db.getAllAsync<{ playlist_id: string; lesson_id: string; position: number }>(
            'select * from playlist_items where playlist_id = ? order by position asc',
            playlistId,
          );
          return rows.map(
            (row): PlaylistItemRow => ({
              playlistId: row.playlist_id,
              lessonId: row.lesson_id,
              position: row.position,
            }),
          );
        }),
      );
    },
    async addPlaylistItem(playlistId, lessonId) {
      return withPlaylistWrite(async () =>
        withDb(async (db) => {
          const existing = await db.getFirstAsync<{ position: number }>(
            'select position from playlist_items where playlist_id = ? and lesson_id = ?',
            playlistId,
            lessonId,
          );
          if (existing) return;
          const maxRow = await db.getFirstAsync<{ max_pos: number | null }>(
            'select max(position) as max_pos from playlist_items where playlist_id = ?',
            playlistId,
          );
          const position = (maxRow?.max_pos ?? -1) + 1;
          await db.runAsync(
            'insert into playlist_items (playlist_id, lesson_id, position) values (?, ?, ?)',
            playlistId,
            lessonId,
            position,
          );
          const now = new Date().toISOString();
          await db.runAsync('update playlists set updated_at = ? where id = ?', now, playlistId);
        }),
      );
    },
    async removePlaylistItem(playlistId, lessonId) {
      return withPlaylistWrite(async () =>
        withDb(async (db) => {
          await db.runAsync('delete from playlist_items where playlist_id = ? and lesson_id = ?', playlistId, lessonId);
          const now = new Date().toISOString();
          await db.runAsync('update playlists set updated_at = ? where id = ?', now, playlistId);
        }),
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
