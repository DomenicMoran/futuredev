import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SQLite from 'expo-sqlite';

const sqliteModule = vi.hoisted(() => ({ openDatabaseAsync: vi.fn() }));
vi.mock('expo-sqlite', () => sqliteModule);

import { createSqliteDatabase } from './sqliteDatabase.js';
import type { ProgressRow } from './types.js';

interface LegacyRow { lesson_id: string; leitner_stage: number; due_at: string; error_count: number }
interface ArchiveRow { id: string; leitner_stage: number; due_at: string; error_count: number; archived_at: string; reason: string }
interface FakeState { progress: ProgressRow[]; legacy: LegacyRow[]; archive: ArchiveRow[]; stable: boolean; version: number; failAt?: string; commitWorkRan?: boolean }
type TransactionCallback = Parameters<SQLite.SQLiteDatabase['withExclusiveTransactionAsync']>[0];

function fakeConnection(state: FakeState): SQLite.SQLiteDatabase {
  const connection = {
    async execAsync(sql: string) {
      if (sql.includes('create table if not exists legacy_review_archive')) return undefined;
      if (sql.includes('alter table reviews rename')) { if (state.failAt === 'alter') throw new Error('fail alter'); state.stable = true; }
      if (sql.includes('create table reviews (')) { if (state.failAt === 'create') throw new Error('fail create'); }
      if (sql.includes('drop table reviews_legacy_v2')) state.legacy = [];
      return undefined;
    },
    async runAsync(sql: string, ...args: (string | number | null)[]) {
      if (args[0] === 'schema_version') { if (state.failAt === 'version' && Number(args[1]) === 3) throw new Error('fail version'); state.version = Math.max(state.version, Number(args[1])); }
      if (sql.includes('insert into legacy_review_archive')) {
        if (state.failAt === 'archive') throw new Error('fail archive');
        const [id, leitnerStage, dueAt, errorCount] = args;
        if (!state.archive.some((row) => row.id === id)) state.archive.push({ id: String(id), leitner_stage: Number(leitnerStage), due_at: String(dueAt), error_count: Number(errorCount), archived_at: 'now', reason: 'legacy-question-index-unknown' });
      }
      if (sql.includes('insert into progress')) {
        const [lessonId, progressState, readUntil, listenedUntil, quizScore, quizPassed, updatedAt] = args;
        const row: ProgressRow = {
          lessonId: String(lessonId), state: String(progressState) as ProgressRow['state'],
          readUntil: readUntil as number | null, listenedUntil: listenedUntil as number | null,
          quizScore: quizScore as number | null, quizPassed: quizPassed === 1,
          updatedAt: String(updatedAt),
        };
        state.progress = [...state.progress.filter((item) => item.lessonId !== row.lessonId), row];
      }
      return { changes: 1 };
    },
    async getAllAsync<T>(sql: string) {
      if (sql.includes('pragma table_info(reviews)')) return (state.stable ? [{ name: 'source_lesson_id' }] : [{ name: 'lesson_id' }]) as T[];
      if (sql.includes('from reviews') && sql.includes('lesson_id')) return state.legacy as T[];
      if (sql.includes('from legacy_review_archive') && sql.includes('leitner_stage')) return state.archive as T[];
      if (sql.includes('from legacy_review_archive')) return state.archive.map(({ id }) => ({ id })) as T[];
      const rows = sql.includes('from progress') ? state.progress.map((row) => ({
        lesson_id: row.lessonId,
        state: row.state,
        read_until: row.readUntil,
        listened_until: row.listenedUntil,
        quiz_score: row.quizScore,
        quiz_passed: row.quizPassed ? 1 : 0,
        updated_at: row.updatedAt,
      })) : [];
      return rows as T[];
    },
    async getFirstAsync<T>(sql: string, ...args: (string | number | null)[]) {
      if (sql.includes('settings')) return (state.version ? { value: String(state.version) } : null) as T | null;
      if (sql.includes('from progress')) return (state.progress.find((row) => row.lessonId === args[0]) ?? null) as T | null;
      return null;
    },
    async withExclusiveTransactionAsync(work: TransactionCallback) {
      const draft = structuredClone(state);
      await work(fakeConnection(draft) as Parameters<TransactionCallback>[0]);
      if (state.failAt === 'commit') {
        state.commitWorkRan = draft.stable && draft.archive.length > 0 && draft.version === 3;
        throw new Error('fail commit');
      }
      Object.assign(state, draft);
    },
  };
  return connection as unknown as SQLite.SQLiteDatabase;
}

describe('SQLite transaction adapter isolation', () => {
  let state: FakeState;
  beforeEach(() => {
    state = { progress: [], legacy: [], archive: [], stable: true, version: 2 };
    sqliteModule.openDatabaseAsync.mockResolvedValue(fakeConnection(state));
  });

  it('serializes a normal write after a failed restore and keeps the write committed', async () => {
    const db = createSqliteDatabase();
    let transactionStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { transactionStarted = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    const imported: ProgressRow = { lessonId: 'imported', state: 'started', readUntil: 1, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' };
    const local: ProgressRow = { ...imported, lessonId: 'local', updatedAt: '2026-01-02T00:00:00.000Z' };
    const restore = db.transaction(async (tx) => {
      await tx.upsertProgress(imported);
      transactionStarted();
      await held;
      throw new Error('forced rollback');
    });
    await started;
    let localCommitted = false;
    const localWrite = db.upsertProgress(local).then(() => { localCommitted = true; });
    await Promise.resolve();
    expect(localCommitted).toBe(false);
    release();
    await expect(restore).rejects.toThrow('forced rollback');
    await localWrite;
    expect(await db.listProgress()).toEqual([local]);
  });

  it('allows nested transaction facade work without re-entering the FIFO queue', async () => {
    const db = createSqliteDatabase();
    const row: ProgressRow = { lessonId: 'nested', state: 'started', readUntil: 2, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' };
    await db.transaction(async (tx) => tx.transaction(async (nested) => nested.upsertProgress(row)));
    expect(await db.listProgress()).toEqual([row]);
  });

  it.each(['archive', 'alter', 'create', 'version', 'commit'])('rolls back migration failure at %s and retries on same connection', async (failAt) => {
    state.stable = false;
    state.version = 2;
    state.legacy = [{ lesson_id: 'old#q1', leitner_stage: 3, due_at: '2026-01-01T00:00:00.000Z', error_count: 4 }];
    state.failAt = failAt;
    const db = createSqliteDatabase();
    await expect(db.init()).rejects.toThrow(`fail ${failAt}`);
    if (failAt === 'commit') expect(state.commitWorkRan).toBe(true);
    expect(state).toMatchObject({ stable: false, version: 2, legacy: [{ lesson_id: 'old#q1' }], archive: [] });
    state.failAt = undefined;
    await db.init();
    expect(state).toMatchObject({ stable: true, version: 3, archive: [{ id: 'old#q1', leitner_stage: 3, due_at: '2026-01-01T00:00:00.000Z', error_count: 4 }] });
    const archive = structuredClone(state.archive);
    await db.init();
    expect(state.archive).toEqual(archive);
    expect(await db.getSchemaVersion()).toBe(3);
  });
});
