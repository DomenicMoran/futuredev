import { describe, expect, it } from 'vitest';
import { keyListenTarget, keySentenceWindows } from './keyWindows.js';

const blocks = [
  { isKeySentence: false, startSeconds: 0, durationSeconds: 10 },
  { isKeySentence: true, startSeconds: 12, durationSeconds: 4 },
  { isKeySentence: true, startSeconds: 40, durationSeconds: 5 },
];

describe('keySentenceWindows', () => {
  it('behält nur markierte Stellen', () => {
    expect(keySentenceWindows(blocks)).toEqual([
      { startSeconds: 12, endSeconds: 16 },
      { startSeconds: 40, endSeconds: 45 },
    ]);
  });
});

describe('keyListenTarget', () => {
  const windows = keySentenceWindows(blocks);

  it('springt von der Einleitung zur ersten Schlüsselstelle', () => {
    expect(keyListenTarget(1, windows)).toBe(12);
  });

  it('bleibt innerhalb einer Schlüsselstelle', () => {
    expect(keyListenTarget(13, windows)).toBeNull();
  });

  it('beendet die Wiedergabe nach der letzten Schlüsselstelle', () => {
    expect(keyListenTarget(46, windows)).toBe('pause');
  });
});
