import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUEUE,
  currentItem,
  enqueue,
  goToNext,
  goToPrevious,
  hasNext,
  hasPrevious,
  removeAt,
  reorder,
  setQueue,
} from './queue.js';
import type { QueueItem } from './types.js';

const item = (lessonId: string): QueueItem => ({ lessonId, title: lessonId, durationSeconds: 100 });

describe('setQueue', () => {
  it('liefert die leere Warteschlange für eine leere Liste', () => {
    expect(setQueue([])).toEqual(EMPTY_QUEUE);
  });

  it('setzt currentIndex auf den Startindex', () => {
    const state = setQueue([item('a'), item('b')], 1);
    expect(currentItem(state)?.lessonId).toBe('b');
  });

  it('klemmt einen zu großen Startindex auf den letzten Titel', () => {
    const state = setQueue([item('a'), item('b')], 99);
    expect(currentItem(state)?.lessonId).toBe('b');
  });
});

describe('goToNext/goToPrevious', () => {
  it('geht zum nächsten Titel', () => {
    const state = setQueue([item('a'), item('b'), item('c')]);
    expect(currentItem(goToNext(state))?.lessonId).toBe('b');
  });

  it('bleibt am letzten Titel stehen', () => {
    const state = setQueue([item('a'), item('b')], 1);
    expect(hasNext(state)).toBe(false);
    expect(goToNext(state)).toBe(state);
  });

  it('geht zum vorherigen Titel', () => {
    const state = setQueue([item('a'), item('b')], 1);
    expect(currentItem(goToPrevious(state))?.lessonId).toBe('a');
  });

  it('bleibt am ersten Titel stehen', () => {
    const state = setQueue([item('a'), item('b')]);
    expect(hasPrevious(state)).toBe(false);
    expect(goToPrevious(state)).toBe(state);
  });
});

describe('enqueue', () => {
  it('hängt Titel ans Ende an', () => {
    const state = setQueue([item('a')]);
    const next = enqueue(state, [item('b'), item('c')]);
    expect(next.items.map((i) => i.lessonId)).toEqual(['a', 'b', 'c']);
    expect(next.currentIndex).toBe(0);
  });

  it('startet die Warteschlange, wenn sie vorher leer war', () => {
    const next = enqueue(EMPTY_QUEUE, [item('a')]);
    expect(currentItem(next)?.lessonId).toBe('a');
  });
});

describe('removeAt', () => {
  it('entfernt einen Titel vor dem laufenden, currentIndex rutscht nach', () => {
    const state = setQueue([item('a'), item('b'), item('c')], 2);
    const next = removeAt(state, 0);
    expect(next.items.map((i) => i.lessonId)).toEqual(['b', 'c']);
    expect(currentItem(next)?.lessonId).toBe('c');
  });

  it('entfernt den laufenden Titel selbst, nächster rückt nach', () => {
    const state = setQueue([item('a'), item('b'), item('c')], 1);
    const next = removeAt(state, 1);
    expect(currentItem(next)?.lessonId).toBe('c');
  });

  it('entfernt den letzten laufenden Titel, bleibt am neuen Ende', () => {
    const state = setQueue([item('a'), item('b')], 1);
    const next = removeAt(state, 1);
    expect(currentItem(next)?.lessonId).toBe('a');
  });

  it('leert die Warteschlange, wenn der letzte Titel entfernt wird', () => {
    const state = setQueue([item('a')]);
    expect(removeAt(state, 0)).toEqual(EMPTY_QUEUE);
  });

  it('ignoriert einen Index außerhalb der Liste', () => {
    const state = setQueue([item('a')]);
    expect(removeAt(state, 5)).toBe(state);
  });
});

describe('reorder', () => {
  it('verschiebt einen Titel ans Ende und currentIndex folgt', () => {
    const state = setQueue([item('a'), item('b'), item('c')], 0);
    const next = reorder(state, 0, 2);
    expect(next.items.map((i) => i.lessonId)).toEqual(['b', 'c', 'a']);
    expect(currentItem(next)?.lessonId).toBe('a');
  });

  it('passt currentIndex an, wenn ein anderer Titel darüber hinwegzieht', () => {
    const state = setQueue([item('a'), item('b'), item('c')], 1);
    const next = reorder(state, 0, 2);
    expect(currentItem(next)?.lessonId).toBe('b');
  });

  it('ignoriert gleiche Indizes', () => {
    const state = setQueue([item('a'), item('b')]);
    expect(reorder(state, 0, 0)).toBe(state);
  });
});
