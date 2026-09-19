import { describe, expect, it } from 'vitest';
import { formatAudioPlan, formatContentPlan, withDryRunPrefix } from '../src/format.js';

describe('formatContentPlan', () => {
  it('beschreibt einen Lektionsschritt mit Pfad und Grund', () => {
    const lines = formatContentPlan([{ kind: 'lesson', id: 'M01-01-01', path: 'lessons/M01-01-01.abc.json', reason: 'neu' }]);
    expect(lines).toEqual(['content: lessons/M01-01-01.abc.json hochladen (neu)']);
  });

  it('beschreibt einen geaenderten Manifest-Schritt', () => {
    expect(formatContentPlan([{ kind: 'manifest', changed: true }])).toEqual(['content: manifest.json hochladen (geaendert)']);
  });

  it('beschreibt einen uebersprungenen Manifest-Schritt', () => {
    expect(formatContentPlan([{ kind: 'manifest', changed: false }])).toEqual([
      'content: manifest.json unveraendert, wird uebersprungen',
    ]);
  });
});

describe('formatAudioPlan', () => {
  it('beschreibt MP3-, Cue- und Skip-Schritte', () => {
    const lines = formatAudioPlan([
      { kind: 'audio-mp3', id: 'M01-01-01', reason: 'neu' },
      { kind: 'audio-cues', id: 'M01-01-01', reason: 'neu' },
      { kind: 'audio-skip', id: 'M01-01-02', reason: 'keine MP3 im Audio-Ordner gefunden' },
    ]);
    expect(lines).toEqual([
      'audio: M01-01-01.mp3 hochladen (neu)',
      'audio: M01-01-01.cues.json hochladen (neu)',
      'audio: M01-01-02 uebersprungen (keine MP3 im Audio-Ordner gefunden)',
    ]);
  });
});

describe('withDryRunPrefix', () => {
  it('stellt jeder Zeile das Praefix [dry-run] voran', () => {
    expect(withDryRunPrefix(['a', 'b'])).toEqual(['[dry-run] a', '[dry-run] b']);
  });
});
