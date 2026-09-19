import { describe, expect, it } from 'vitest';
import { planAudioUploads, type AudioLocalInfo } from '../src/plan.js';

function info(overrides: Partial<AudioLocalInfo> & { id: string }): AudioLocalInfo {
  return {
    mp3Exists: true,
    mp3Sha256: 'a'.repeat(64),
    cuesExists: true,
    cuesSha256: 'b'.repeat(64),
    ...overrides,
  };
}

describe('planAudioUploads', () => {
  it('laedt MP3 und Cue-Datei einer neuen Lektion hoch, wenn keine Sidecar-Pruefsumme vorliegt', () => {
    const lessons = [{ id: 'M01-01-01' }];
    const local = new Map([['M01-01-01', info({ id: 'M01-01-01' })]]);
    const steps = planAudioUploads(lessons, local, new Map(), new Map());
    expect(steps).toEqual([
      { kind: 'audio-mp3', id: 'M01-01-01', reason: 'neu' },
      { kind: 'audio-cues', id: 'M01-01-01', reason: 'neu' },
    ]);
  });

  it('ueberspringt eine Lektion ohne MP3-Datei im Audio-Ordner', () => {
    const lessons = [{ id: 'M01-01-01' }];
    const local = new Map([['M01-01-01', info({ id: 'M01-01-01', mp3Exists: false, mp3Sha256: null })]]);
    const steps = planAudioUploads(lessons, local, new Map(), new Map());
    expect(steps).toEqual([
      { kind: 'audio-skip', id: 'M01-01-01', reason: 'keine MP3 im Audio-Ordner gefunden' },
    ]);
  });

  it('ueberspringt eine Lektion mit MP3, aber ohne Cue-Datei, und meldet den Grund', () => {
    const lessons = [{ id: 'M01-01-01' }];
    const local = new Map([['M01-01-01', info({ id: 'M01-01-01', cuesExists: false, cuesSha256: null })]]);
    const steps = planAudioUploads(lessons, local, new Map(), new Map());
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe('audio-skip');
    expect((steps[0] as { reason: string }).reason).toMatch(/Cue-Datei/);
  });

  it('laedt nichts hoch, wenn beide Sidecar-Pruefsummen bereits passen', () => {
    const lessons = [{ id: 'M01-01-01' }];
    const local = new Map([['M01-01-01', info({ id: 'M01-01-01' })]]);
    const remoteMp3 = new Map([['M01-01-01', 'a'.repeat(64)]]);
    const remoteCues = new Map([['M01-01-01', 'b'.repeat(64)]]);
    expect(planAudioUploads(lessons, local, remoteMp3, remoteCues)).toEqual([]);
  });

  it('laedt nur die MP3 nach, wenn sich nur deren Pruefsumme geaendert hat', () => {
    const lessons = [{ id: 'M01-01-01' }];
    const local = new Map([['M01-01-01', info({ id: 'M01-01-01' })]]);
    const remoteMp3 = new Map([['M01-01-01', 'z'.repeat(64)]]);
    const remoteCues = new Map([['M01-01-01', 'b'.repeat(64)]]);
    const steps = planAudioUploads(lessons, local, remoteMp3, remoteCues);
    expect(steps).toEqual([{ kind: 'audio-mp3', id: 'M01-01-01', reason: 'geaendert' }]);
  });
});
