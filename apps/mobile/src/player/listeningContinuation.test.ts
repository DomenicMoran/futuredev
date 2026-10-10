import { describe, expect, it } from 'vitest';
import { deriveLessonStatus } from '../data/lessonStatus.js';
import { resolveListeningContinuation, shouldResumeLiveListening, remainingListeningMinutes } from './listeningContinuation.js';
const lessons = ['a', 'b', 'c'].map(id => ({ id, title: id, durationMinutes: 10 }));
const status = (seconds: number, date: string, heard = false) => ({ ...deriveLessonStatus(), listenedUntil: seconds, audioUpdatedAt: date, heard });
describe('listening continuation selection', () => {
  it('uses exact audio duration rather than rounded catalogue minutes for time remaining', () => {
    expect(remainingListeningMinutes({ id: 'a', title: 'a', durationMinutes: 18, durationSeconds: 1028 }, 215)).toBe(14);
  });
  it('only keeps completed live tracks when actively replaying them', () => {
    expect(shouldResumeLiveListening({ ...deriveLessonStatus(), done: true }, 50, 600, false)).toBe(false);
    expect(shouldResumeLiveListening({ ...deriveLessonStatus(), heard: true }, 50, 600, true)).toBe(true);
    expect(shouldResumeLiveListening(undefined, 600, 600, false)).toBe(false);
  });
  it('resumes latest audio rather than a recently read lesson', () => {
    const result = resolveListeningContinuation(lessons, { a: status(210, '2026-01-01'), b: { ...deriveLessonStatus(), read: true, started: true } });
    expect(result).toMatchObject({ lesson: { id: 'a' }, seconds: 210, next: false });
  });
  it('moves past heard/completed lessons including manually marked ones', () => {
    expect(resolveListeningContinuation(lessons, { a: status(600, '2026-01-01', true), b: { ...deriveLessonStatus(), done: true } })).toMatchObject({ lesson: { id: 'c' }, seconds: 0, next: true });
  });
  it('moves beyond a track at its end without falsely marking it heard', () => {
    expect(resolveListeningContinuation(lessons, { a: status(600, '2026-01-01') })).toMatchObject({ lesson: { id: 'b' }, next: true });
  });
  it('offers first unfinished lesson on fresh install and no misleading restart after final lesson', () => {
    expect(resolveListeningContinuation(lessons, {})).toMatchObject({ lesson: { id: 'a' }, seconds: 0 });
    expect(resolveListeningContinuation(lessons, { c: status(600, '2026-01-01', true) })).toBeNull();
    expect(resolveListeningContinuation([], {})).toBeNull();
  });
});
