import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from './db.js';
import { saveReadPosition } from './progress.js';
import { drawRound, evaluateRound } from '../quiz/roundLogic.js';
import { recordQuizRound } from '../quiz/results.js';
import { makeTestPool } from '../quiz/testPool.js';
import type { Database } from './types.js';

describe('atomic progress read-modify-write', () => {
  beforeEach(() => { resetToMemoryDatabase(); });

  it('serializes a delayed position transaction before a quiz completion without losing either update', async () => {
    const db = await getDatabase();
    await db.upsertProgress({ lessonId: 'M01-01-01', state: 'read', readUntil: 2, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' });
    const originalTransaction = db.transaction.bind(db);
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let delayed = false;
    db.transaction = ((work: Parameters<Database['transaction']>[0]) => originalTransaction(async (tx) => {
      if (!delayed) { delayed = true; started(); await gate; }
      return work(tx);
    })) as Database['transaction'];

    const positionWrite = saveReadPosition('M01-01-01', 8);
    await startedPromise;
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 22);
    const answers = round.drawn.map((q, i) => ({ questionIndex: i, chosenOptionIndex: q.options.findIndex((o) => o.isCorrect) }));
    const quizWrite = recordQuizRound({ scope: { type: 'lesson', lessonId: 'M01-01-01' }, round, answers, result: evaluateRound(round, answers) });
    release();
    await Promise.all([positionWrite, quizWrite]);
    expect(await db.getProgress('M01-01-01')).toMatchObject({ state: 'completed', readUntil: 8, quizScore: 100, quizPassed: true });
  });
});
