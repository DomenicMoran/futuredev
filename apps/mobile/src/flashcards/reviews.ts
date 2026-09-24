import { createCard, reviewCard, type LeitnerCard } from '@futuredev/core';
import { getDatabase } from '../data/db.js';

const STORAGE_KEY = 'flashcards.leitner';

type StoredMap = Record<string, LeitnerCard>;

async function readMap(): Promise<StoredMap> {
  const db = await getDatabase();
  const raw = await db.getSetting(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: StoredMap): Promise<void> {
  const db = await getDatabase();
  await db.setSetting(STORAGE_KEY, JSON.stringify(map));
}

export async function loadFlashcardLeitner(cardId: string): Promise<LeitnerCard> {
  const map = await readMap();
  return map[cardId] ?? createCard(cardId);
}

export async function saveFlashcardReview(cardId: string, wasCorrect: boolean): Promise<LeitnerCard> {
  const map = await readMap();
  const current = map[cardId] ?? createCard(cardId);
  const updated = reviewCard(current, wasCorrect);
  map[cardId] = updated;
  await writeMap(map);
  return updated;
}
