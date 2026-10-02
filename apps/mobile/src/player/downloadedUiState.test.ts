import { describe, expect, it } from 'vitest';
import { reconcileDownloadedUiState } from './downloadedUiState.js';

describe('download screen persisted state reconciliation', () => {
  it('removes canceled lesson only if no valid prior generation remains', () => {
    expect(reconcileDownloadedUiState({ lessonA: true, lessonB: true }, 'lessonA', false)).toEqual({ lessonB: true });
  });
  it('retains/adds the downloaded badge when canceling a retry leaves an older valid generation', () => {
    expect(reconcileDownloadedUiState({ lessonB: true }, 'lessonA', true)).toEqual({ lessonB: true, lessonA: true });
  });
});
