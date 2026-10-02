import { createCard, reviewCard, type LeitnerCard } from '@futuredev/core';
import { getDatabase } from '../data/db.js';

export const FLASHCARD_STORAGE_KEY = 'flashcards.leitner';

type StoredMap = Record<string, LeitnerCard>;

let writeTail = Promise.resolve();
let resetGeneration = 0;
let activeResetGeneration: number | null = null;

function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
  const startedGeneration = resetGeneration;
  const task = writeTail.then(async () => {
    if (activeResetGeneration !== null) {
      throw new Error('flashcard review reset in progress');
    }
    if (startedGeneration !== resetGeneration) {
      throw new Error('flashcard review write invalidated by reset');
    }
    return work();
  });
  writeTail = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

export function beginFlashcardReviewReset(): { ready: Promise<void>; release: () => void } {
  activeResetGeneration = resetGeneration;
  const ready = writeTail.then(() => undefined);
  return {
    ready,
    release: () => {
      resetGeneration += 1;
      activeResetGeneration = null;
    },
  };
}

async function readMap(): Promise<StoredMap> {
  const db = await getDatabase();
  const raw = await db.getSetting(FLASHCARD_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new Error('flashcard review map contains invalid JSON');
  }
}

async function writeMap(map: StoredMap): Promise<void> {
  const db = await getDatabase();
  await db.setSetting(FLASHCARD_STORAGE_KEY, JSON.stringify(map));
}

export async function loadFlashcardLeitner(cardId: string): Promise<LeitnerCard> {
  const map = await readMap();
  return map[cardId] ?? createCard(cardId);
}

export async function saveFlashcardReview(cardId: string, wasCorrect: boolean): Promise<LeitnerCard> {
  return enqueueWrite(async () => {
    const map = await readMap();
    const current = map[cardId] ?? createCard(cardId);
    const updated = reviewCard(current, wasCorrect);
    map[cardId] = updated;
    await writeMap(map);
    return updated;
  });
}
