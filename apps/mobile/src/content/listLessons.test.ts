import { describe, expect, it } from 'vitest';
import { getFirstPublishedLessonId, type ModuleListEntry } from './listLessons.js';

describe('getFirstPublishedLessonId', () => {
  it('liefert die erste Lektion des ersten Moduls mit Inhalt', () => {
    const list: ModuleListEntry[] = [
      { id: 'M01', title: 'A', subModules: [{ id: 'M01-01', title: 'S', lessons: [{ id: 'M01-01-01', title: 'L1', durationMinutes: 5, available: true, state: 'new' }] }], totalLessons: 1, completedLessons: 0 },
      { id: 'M02', title: 'B', subModules: [], totalLessons: 0, completedLessons: 0 },
    ];
    expect(getFirstPublishedLessonId(list)).toBe('M01-01-01');
  });

  it('überspringt Module ohne Lektionen', () => {
    const list: ModuleListEntry[] = [
      { id: 'M01', title: 'A', subModules: [], totalLessons: 0, completedLessons: 0 },
      { id: 'M02', title: 'B', subModules: [{ id: 'M02-01', title: 'S', lessons: [{ id: 'M02-01-01', title: 'L', durationMinutes: 1, available: true, state: 'new' }] }], totalLessons: 1, completedLessons: 0 },
    ];
    expect(getFirstPublishedLessonId(list)).toBe('M02-01-01');
  });

  it('gibt null zurück wenn nichts veröffentlicht ist', () => {
    expect(getFirstPublishedLessonId([])).toBeNull();
  });
});
