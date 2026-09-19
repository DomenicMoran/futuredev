import { describe, expect, it } from 'vitest';
import { computeModuleProgress, createLessonProgress, transitionLesson } from '../src/progress.js';

describe('transitionLesson', () => {
  it('erlaubt den Weg von new bis completed', () => {
    let p = createLessonProgress('M01-01-01');
    expect(p.state).toBe('new');
    p = transitionLesson(p, 'started');
    expect(p.state).toBe('started');
    p = transitionLesson(p, 'read');
    expect(p.state).toBe('read');
    p = transitionLesson(p, 'listened');
    expect(p.state).toBe('listened');
    p = transitionLesson(p, 'quiz_passed');
    expect(p.state).toBe('quiz_passed');
    p = transitionLesson(p, 'completed');
    expect(p.state).toBe('completed');
  });

  it('ignoriert einen nicht erlaubten Sprung von new direkt zu completed', () => {
    const p = createLessonProgress('M01-01-01');
    const next = transitionLesson(p, 'completed');
    expect(next.state).toBe('new');
  });

  it('wirft eine abgeschlossene Lektion nicht durch ein verspätetes Ereignis zurück', () => {
    let p = createLessonProgress('M01-01-01');
    p = transitionLesson(p, 'started');
    p = transitionLesson(p, 'read');
    p = transitionLesson(p, 'listened');
    p = transitionLesson(p, 'quiz_passed');
    p = transitionLesson(p, 'completed');
    const next = transitionLesson(p, 'listened');
    expect(next.state).toBe('completed');
  });
});

describe('computeModuleProgress', () => {
  it('berechnet den Prozentsatz abgeschlossener Lektionen', () => {
    const progresses = [
      { lessonId: 'a', state: 'completed' as const },
      { lessonId: 'b', state: 'completed' as const },
      { lessonId: 'c', state: 'started' as const },
      { lessonId: 'd', state: 'new' as const },
    ];
    const result = computeModuleProgress('M01', progresses);
    expect(result.completedLessons).toBe(2);
    expect(result.totalLessons).toBe(4);
    expect(result.percent).toBe(50);
  });

  it('gibt 0 Prozent bei einem leeren Modul zurück', () => {
    const result = computeModuleProgress('M01', []);
    expect(result.percent).toBe(0);
  });
});
