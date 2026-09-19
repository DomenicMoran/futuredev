import { describe, expect, it } from 'vitest';
import {
  downloadDirPath,
  downloadedAudioPath,
  downloadedCuesPath,
  formatBytes,
  remoteAudioUrl,
  remoteCuesUrl,
} from './downloads.js';

const DOC_DIR = 'file:///data/user/0/de.domenicmoran.futuredev/files/';

describe('Download-Pfade', () => {
  it('baut den Ordnerpfad unter documentDirectory', () => {
    expect(downloadDirPath(DOC_DIR)).toBe(`${DOC_DIR}audio/`);
  });

  it('baut den MP3-Pfad einer Lektion', () => {
    expect(downloadedAudioPath(DOC_DIR, 'M01-01-01')).toBe(`${DOC_DIR}audio/M01-01-01.mp3`);
  });

  it('baut den Cue-Pfad einer Lektion', () => {
    expect(downloadedCuesPath(DOC_DIR, 'M01-01-01')).toBe(`${DOC_DIR}audio/M01-01-01.cues.json`);
  });
});

describe('Remote-URLs', () => {
  it('baut die MP3-URL ohne doppelten Schrägstrich', () => {
    expect(remoteAudioUrl('https://example.com/audio/', 'M01-01-01')).toBe(
      'https://example.com/audio/M01-01-01.mp3',
    );
  });

  it('baut die Cue-URL', () => {
    expect(remoteCuesUrl('https://example.com/audio', 'M01-01-01')).toBe(
      'https://example.com/audio/M01-01-01.cues.json',
    );
  });
});

describe('formatBytes', () => {
  it('zeigt Bytes unter 1 KB', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('zeigt Kilobyte gerundet', () => {
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('zeigt Megabyte mit einer Nachkommastelle', () => {
    expect(formatBytes(9_000_000)).toBe('8.6 MB');
  });
});
