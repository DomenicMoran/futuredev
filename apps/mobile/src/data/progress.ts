import type { LessonState } from '@futuredev/core';
import { transitionLesson, createLessonProgress } from '@futuredev/core';
import { getDatabase } from './db.js';
import type { Database, ProgressRow } from './types.js';

const lessonWriteQueues = new Map<string, Promise<void>>();
let lessonWriteEpoch = 0;

function serializeLessonWrite<T>(lessonId: string, work: (tx: Database) => Promise<T>): Promise<T> {
  const requestEpoch = lessonWriteEpoch;
  const previous = lessonWriteQueues.get(lessonId) ?? Promise.resolve();
  const run = async () => {
    if (requestEpoch !== lessonWriteEpoch) throw new Error('Lesson progress write invalidated by data reset');
    const db = await getDatabase();
    if (requestEpoch !== lessonWriteEpoch) throw new Error('Lesson progress write invalidated by data reset');
    // Every state-dependent progress write shares the same DB transaction
    // queue as quiz results and imports; no global get-then-upsert can go stale.
    return db.transaction(work);
  };
  const result = previous.then(run, run);
  const settled = result.then(() => undefined, () => undefined);
  lessonWriteQueues.set(lessonId, settled);
  void settled.then(() => {
    if (lessonWriteQueues.get(lessonId) === settled) lessonWriteQueues.delete(lessonId);
  });
  return result;
}

/** Invalidates not-yet-started progress writes, then drains active DB transactions before reset. */
export async function drainLessonProgressWrites(): Promise<void> {
  lessonWriteEpoch += 1;
  await Promise.all([...lessonWriteQueues.values()]);
}

export async function getProgress(lessonId: string): Promise<ProgressRow | undefined> {
  const db = await getDatabase();
  return db.getProgress(lessonId);
}

export async function listProgress(): Promise<ProgressRow[]> {
  const db = await getDatabase();
  return db.listProgress();
}

export function upsertProgress(row: ProgressRow): Promise<void> {
  return serializeLessonWrite(row.lessonId, (tx) => tx.upsertProgress(row));
}

function emptyProgress(lessonId: string): ProgressRow {
  return {
    lessonId,
    state: createLessonProgress(lessonId).state,
    readUntil: null,
    listenedUntil: null,
    quizScore: null,
    quizPassed: false,
    updatedAt: new Date().toISOString(),
  };
}

async function readProgress(tx: Database, lessonId: string): Promise<ProgressRow> {
  return (await tx.getProgress(lessonId)) ?? emptyProgress(lessonId);
}

async function writeStateInTransaction(
  tx: Database,
  lessonId: string,
  nextState: LessonState,
  extra: Partial<Pick<ProgressRow, 'readUntil' | 'listenedUntil' | 'quizScore' | 'quizPassed'>> = {},
): Promise<ProgressRow> {
  const current = await readProgress(tx, lessonId);
  const state = transitionLesson({ lessonId, state: current.state }, nextState).state;
  const updated: ProgressRow = { ...current, ...extra, state, updatedAt: new Date().toISOString() };
  // Quiz competence is sticky, but reading/listening is only completed by the
  // explicit end-of-content actions below, never by an arbitrary state write.
  await tx.upsertProgress(updated);
  return updated;
}

export function markLessonState(
  lessonId: string,
  nextState: LessonState,
  extra: Partial<Pick<ProgressRow, 'readUntil' | 'listenedUntil' | 'quizScore' | 'quizPassed'>> = {},
): Promise<ProgressRow> {
  return serializeLessonWrite(lessonId, (tx) => writeStateInTransaction(tx, lessonId, nextState, extra));
}

async function savePositionInTransaction(
  tx: Database,
  lessonId: string,
  field: 'readUntil' | 'listenedUntil',
  position: number,
): Promise<ProgressRow> {
  const current = await readProgress(tx, lessonId);
  const state = current.state === 'new' ? 'started' : current.state;
  const updated = { ...current, state, [field]: position, updatedAt: new Date().toISOString() };
  await tx.upsertProgress(updated);
  return updated;
}

export function saveReadPosition(lessonId: string, blockIndex: number): Promise<ProgressRow> {
  return serializeLessonWrite(lessonId, (tx) => savePositionInTransaction(tx, lessonId, 'readUntil', blockIndex));
}

/** Position-only player write; deliberately does not imply the audio finished. */
export function saveListenPosition(lessonId: string, seconds: number): Promise<ProgressRow> {
  return serializeLessonWrite(lessonId, (tx) => savePositionInTransaction(tx, lessonId, 'listenedUntil', Math.round(seconds)));
}

async function completeAfterQuizIfEarned(tx: Database, progress: ProgressRow): Promise<ProgressRow> {
  if (!progress.quizPassed) return progress;
  let state = progress.state;
  if (state === 'read' || state === 'listened') state = transitionLesson({ lessonId: progress.lessonId, state }, 'quiz_passed').state;
  if (state === 'quiz_passed') state = transitionLesson({ lessonId: progress.lessonId, state }, 'completed').state;
  if (state === progress.state) return progress;
  const completed = { ...progress, state, updatedAt: new Date().toISOString() };
  await tx.upsertProgress(completed);
  return completed;
}

export function markLessonRead(lessonId: string): Promise<ProgressRow> {
  return serializeLessonWrite(lessonId, async (tx) => {
    let current = await readProgress(tx, lessonId);
    if (current.state === 'new') current = await writeStateInTransaction(tx, lessonId, 'started');
    if (current.state === 'started') current = await writeStateInTransaction(tx, lessonId, 'read');
    await completeAfterQuizIfEarned(tx, current);
    const persisted = await tx.getProgress(lessonId);
    const readableStates: LessonState[] = ['read', 'listened', 'quiz_passed', 'completed'];
    if (!persisted || !readableStates.includes(persisted.state)) {
      throw new Error(`Leseabschluss wurde nicht gespeichert: ${persisted?.state ?? 'kein Fortschritt'}`);
    }
    return persisted;
  });
}

/** Audio completion is likewise a deliberate endpoint, not a periodic position update. */
export function markLessonListened(lessonId: string, seconds: number): Promise<ProgressRow> {
  return serializeLessonWrite(lessonId, async (tx) => {
    let current = await readProgress(tx, lessonId);
    if (current.state === 'new') current = await writeStateInTransaction(tx, lessonId, 'started');
    if (current.state === 'started' || current.state === 'read') {
      current = await writeStateInTransaction(tx, lessonId, 'listened', { listenedUntil: Math.round(seconds) });
    } else {
      current = { ...current, listenedUntil: Math.round(seconds), updatedAt: new Date().toISOString() };
      await tx.upsertProgress(current);
    }
    current = await completeAfterQuizIfEarned(tx, current);
    return (await tx.getProgress(lessonId)) ?? current;
  });
}
