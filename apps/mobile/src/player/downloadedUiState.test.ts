import { describe, expect, it } from 'vitest';
import { reconcileDownloadAvailability, reconcileDownloadedUiState } from './downloadedUiState.js';

describe('download screen persisted state reconciliation', () => {
  it('removes canceled lesson only if no valid prior generation remains', () => {
    expect(reconcileDownloadedUiState({ lessonA: true, lessonB: true }, 'lessonA', false)).toEqual({ lessonB: true });
  });
  it('retains/adds the downloaded badge when canceling a retry leaves an older valid generation', () => {
    expect(reconcileDownloadedUiState({ lessonB: true }, 'lessonA', true)).toEqual({ lessonB: true, lessonA: true });
  });
});


describe('availability identity during download progress', () => {
  it('preserves identity for progress-only events and unrelated cached lessons', () => {
    const current = { cached: true };
    expect(reconcileDownloadAvailability(current, { active: { status: 'downloading' } })).toBe(current);
    expect(reconcileDownloadAvailability(current, { active: { status: 'error' } })).toBe(current);
    expect(reconcileDownloadAvailability(current, { cached: { status: 'downloaded' } })).toBe(current);
  });
  it('copies only for an actual availability transition, without mutating input', () => {
    const current = { cached: true };
    const next = reconcileDownloadAvailability(current, { active: { status: 'downloaded' } });
    expect(next).toEqual({ cached: true, active: true }); expect(next).not.toBe(current);
    expect(current).toEqual({ cached: true });
    expect(reconcileDownloadAvailability(next, { active: { status: 'not-downloaded' } })).toEqual({ cached: true, active: false });
  });
});
