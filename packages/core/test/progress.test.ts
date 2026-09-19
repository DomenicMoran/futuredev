import { describe, expect, it } from 'vitest';
import { computeModuleProgress, createLessonProgress, transitionLesson } from '../src/progress.js';

describe('transitionLesson', () => {
  it('erlaubt den Weg von neu bis abgeschlossen', () => {
    let p = createLessonProgress('M01-01-01');
    expect(p.state).toBe('neu');
    p = transitionLesson(p, 'begonnen');
    expect(p.state).toBe('begonnen');
    p = transitionLesson(p, 'gelesen');
    expect(p.state).toBe('gelesen');
    p = transitionLesson(p, 'gehoert');
    expect(p.state).toBe('gehoert');
    p = transitionLesson(p, 'quiz_bestanden');
    expect(p.state).toBe('quiz_bestanden');
    p = transitionLesson(p, 'abgeschlossen');
    expect(p.state).toBe('abgeschlossen');
  });

  it('ignoriert einen nicht erlaubten Sprung von neu direkt zu abgeschlossen', () => {
    const p = createLessonProgress('M01-01-01');
    const next = transitionLesson(p, 'abgeschlossen');
    expect(next.state).toBe('neu');
  });

  it('wirft eine abgeschlossene Lektion nicht durch ein verspätetes Ereignis zurück', () => {
    let p = createLessonProgress('M01-01-01');
    p = transitionLesson(p, 'begonnen');
    p = transitionLesson(p, 'gelesen');
    p = transitionLesson(p, 'gehoert');
    p = transitionLesson(p, 'quiz_bestanden');
    p = transitionLesson(p, 'abgeschlossen');
    const next = transitionLesson(p, 'gehoert');
    expect(next.state).toBe('abgeschlossen');
  });
});

describe('computeModuleProgress', () => {
  it('berechnet den Prozentsatz abgeschlossener Lektionen', () => {
    const progresses = [
      { lessonId: 'a', state: 'abgeschlossen' as const },
      { lessonId: 'b', state: 'abgeschlossen' as const },
      { lessonId: 'c', state: 'begonnen' as const },
      { lessonId: 'd', state: 'neu' as const },
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
