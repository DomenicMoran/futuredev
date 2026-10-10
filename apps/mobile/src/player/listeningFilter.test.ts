import { describe, expect, it } from 'vitest';
import { deriveLessonStatus } from '../data/lessonStatus.js';
import { matchesListeningFilter } from './listeningFilter.js';
describe('stable status editor under Hören filters', () => {
  it('keeps the edited heard row after unmarking until modal close, preserving Undo', () => {
    const status = deriveLessonStatus(undefined, undefined, { heard: true });
    expect(matchesListeningFilter('a', 'heard', status, false, true, 'a')).toBe(true);
    const unmarked = deriveLessonStatus(undefined, undefined, { heard: false });
    expect(matchesListeningFilter('a', 'heard', unmarked, false, true, 'a')).toBe(true);
    expect(matchesListeningFilter('a', 'heard', unmarked, false, true, null)).toBe(false);
  });
  it('only pins the active editor, not other rows, including when a search index refresh finishes', () => {
    const status = deriveLessonStatus();
    expect(matchesListeningFilter('a', 'heard', status, false, false, 'a')).toBe(true);
    expect(matchesListeningFilter('b', 'heard', status, false, true, 'a')).toBe(false);
  });
});
