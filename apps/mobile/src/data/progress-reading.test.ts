import { describe, expect, it } from 'vitest';
import { persistReadCompletion } from '../navigation/lessonReadingState.js';
import { createMemoryDatabase } from './memoryDatabase.js';
import { drainLessonProgressWrites, getProgress, markLessonRead, markLessonState, saveReadPosition } from './progress.js';
import { setDatabase } from './db.js';

describe('explicit reading completion against MemoryDatabase', () => {
  it('advances a fresh or absent row through started to persisted read, independently of quiz results', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    await db.init();

    const fromAbsent = await markLessonRead('M01-01-01');
    expect(fromAbsent.state).toBe('read');
    expect((await getProgress('M01-01-01'))?.state).toBe('read');

    await db.upsertProgress({
      lessonId: 'M01-01-02', state: 'new', readUntil: null, listenedUntil: null,
      quizScore: null, quizPassed: false, updatedAt: new Date().toISOString(),
    });
    expect((await markLessonRead('M01-01-02')).state).toBe('read');
    expect((await getProgress('M01-01-02'))?.state).toBe('read');
  });

  it('does not downgrade listened, quiz-passed, or completed states', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    await db.init();
    await markLessonState('M01-01-03', 'started');
    await markLessonState('M01-01-03', 'read');
    await markLessonState('M01-01-03', 'listened');
    expect((await markLessonRead('M01-01-03')).state).toBe('listened');

    await markLessonState('M01-01-04', 'started');
    await markLessonState('M01-01-04', 'read');
    await markLessonState('M01-01-04', 'quiz_passed');
    expect((await markLessonRead('M01-01-04')).state).toBe('quiz_passed');
    await markLessonState('M01-01-04', 'completed');
    expect((await markLessonRead('M01-01-04')).state).toBe('completed');
  });

  it('lets explicit completion recover after a failed read-position write', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    await db.init();
    const originalUpsert = db.upsertProgress.bind(db);
    db.upsertProgress = async (_row) => { throw new Error('position write failure'); };
    await expect(saveReadPosition('M01-01-05', 10)).rejects.toThrow('position write failure');
    expect(await db.getProgress('M01-01-05')).toBeUndefined();
    db.upsertProgress = originalUpsert;

    const completion = { done: false, inFlight: false };
    expect(await persistReadCompletion(completion, () => markLessonRead('M01-01-05').then(() => undefined))).toBe('saved');
    expect((await getProgress('M01-01-05'))?.state).toBe('read');
  });

  it('drains active progress work and invalidates pre-wipe queued completions', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    await db.init();
    const originalGet = db.getProgress.bind(db);
    let releaseRead!: () => void;
    let signalReadStarted!: () => void;
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const readStarted = new Promise<void>((resolve) => { signalReadStarted = resolve; });
    db.getProgress = async (lessonId) => {
      if (lessonId === 'M01-01-06') {
        signalReadStarted();
        await readGate;
      }
      return originalGet(lessonId);
    };

    const activeWrite = markLessonState('M01-01-06', 'started');
    await readStarted;
    const staleCompletion = markLessonRead('M01-01-06');
    const drain = drainLessonProgressWrites();
    releaseRead();

    expect((await activeWrite).state).toBe('started');
    await expect(staleCompletion).rejects.toThrow(/invalidated by data reset/);
    await drain;
    expect((await getProgress('M01-01-06'))?.state).toBe('started');
  });

  it('keeps read completion retryable after a real MemoryDatabase write failure', async () => {
    const db = createMemoryDatabase();
    setDatabase(db);
    await db.init();
    const originalUpsert = db.upsertProgress.bind(db);
    let failFirstWrite = true;
    db.upsertProgress = async (row) => {
      if (failFirstWrite) {
        failFirstWrite = false;
        throw new Error('injected write failure');
      }
      await originalUpsert(row);
    };
    const completion = { done: false, inFlight: false };
    const persist = () => markLessonRead('M01-01-04').then(() => undefined);

    expect(await persistReadCompletion(completion, persist)).toBe('failed');
    expect(completion).toEqual({ done: false, inFlight: false });
    expect(await getProgress('M01-01-04')).toBeUndefined();

    expect(await persistReadCompletion(completion, persist)).toBe('saved');
    expect(completion.done).toBe(true);
    expect((await getProgress('M01-01-04'))?.state).toBe('read');
  });
});
