import { describe, expect, it } from 'vitest';
import { collectOrderedPublishedLessonIds, type ModuleListEntry } from './listLessons.js';

const sampleModules: ModuleListEntry[] = [
  {
    id: 'M01',
    title: 'Modul 1',
    totalLessons: 2,
    completedLessons: 0,
    subModules: [
      {
        id: 'M01-00',
        title: 'Intro',
        lessons: [
          { id: 'M01-00-01', title: 'A', durationMinutes: 10, available: true, state: 'new' },
          { id: 'M01-00-02', title: 'B', durationMinutes: 10, available: false, state: 'new' },
        ],
      },
    ],
  },
];

describe('collectOrderedPublishedLessonIds', () => {
  it('liefert nur veröffentlichte Lektionen in Curriculum-Reihenfolge', () => {
    expect(collectOrderedPublishedLessonIds(sampleModules)).toEqual(['M01-00-01']);
  });
});
