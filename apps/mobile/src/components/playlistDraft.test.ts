import { describe, expect, it } from 'vitest';
import { normalizedPlaylistDraft } from './playlistDraft.js';

describe('playlist native input draft', () => {
  it('uses the latest text exactly as entered after trimming', () => {
    expect(normalizedPlaylistDraft('  letzter Buchstabe x  ')).toBe('letzter Buchstabe x');
    expect(normalizedPlaylistDraft('anderer Name')).toBe('anderer Name');
  });

  it('preserves an empty native draft instead of falling back to stale React state', () => {
    expect(normalizedPlaylistDraft('')).toBe('');
    expect(normalizedPlaylistDraft('   ')).toBe('');
  });
});
