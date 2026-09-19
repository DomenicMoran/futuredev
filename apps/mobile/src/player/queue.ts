// Warteschlangen-Logik als reine Funktionen (naechste, vorherige, entfernen,
// umsortieren), getrennt vom Zustand-Speicher, damit Vitest sie ohne
// Track-Player-Attrappe pruefen kann.
import type { PlaybackQueueState, QueueItem } from './types.js';

export const EMPTY_QUEUE: PlaybackQueueState = { items: [], currentIndex: -1 };

export function setQueue(items: readonly QueueItem[], startIndex = 0): PlaybackQueueState {
  if (items.length === 0) return EMPTY_QUEUE;
  const clampedIndex = Math.min(Math.max(startIndex, 0), items.length - 1);
  return { items, currentIndex: clampedIndex };
}

export function currentItem(state: PlaybackQueueState): QueueItem | undefined {
  return state.items[state.currentIndex];
}

export function hasNext(state: PlaybackQueueState): boolean {
  return state.currentIndex >= 0 && state.currentIndex < state.items.length - 1;
}

export function hasPrevious(state: PlaybackQueueState): boolean {
  return state.currentIndex > 0;
}

export function goToNext(state: PlaybackQueueState): PlaybackQueueState {
  if (!hasNext(state)) return state;
  return { ...state, currentIndex: state.currentIndex + 1 };
}

export function goToPrevious(state: PlaybackQueueState): PlaybackQueueState {
  if (!hasPrevious(state)) return state;
  return { ...state, currentIndex: state.currentIndex - 1 };
}

/** Fügt Titel ans Ende der Warteschlange an (etwa "Modul am Stück" nachladen). */
export function enqueue(state: PlaybackQueueState, items: readonly QueueItem[]): PlaybackQueueState {
  if (state.items.length === 0) return setQueue(items);
  return { ...state, items: [...state.items, ...items] };
}

/**
 * Entfernt einen Titel per Index. Läuft er gerade, rückt currentIndex auf den
 * nun an seiner Stelle stehenden Titel nach (bzw. bleibt am Ende stehen, wenn
 * der letzte Titel entfernt wurde).
 */
export function removeAt(state: PlaybackQueueState, index: number): PlaybackQueueState {
  if (index < 0 || index >= state.items.length) return state;
  const items = state.items.filter((_, i) => i !== index);
  if (items.length === 0) return EMPTY_QUEUE;

  let currentIndex = state.currentIndex;
  if (index < state.currentIndex) {
    currentIndex -= 1;
  } else if (index === state.currentIndex) {
    currentIndex = Math.min(currentIndex, items.length - 1);
  }
  return { items, currentIndex };
}

/** Verschiebt den Titel an fromIndex nach toIndex (Ziehen zum Umsortieren). */
export function reorder(state: PlaybackQueueState, fromIndex: number, toIndex: number): PlaybackQueueState {
  if (
    fromIndex < 0 ||
    fromIndex >= state.items.length ||
    toIndex < 0 ||
    toIndex >= state.items.length ||
    fromIndex === toIndex
  ) {
    return state;
  }
  const items = [...state.items];
  const [moved] = items.splice(fromIndex, 1);
  if (!moved) return state;
  items.splice(toIndex, 0, moved);

  let currentIndex = state.currentIndex;
  if (state.currentIndex === fromIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
    currentIndex -= 1;
  } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
    currentIndex += 1;
  }
  return { items, currentIndex };
}
