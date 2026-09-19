import { describe, expect, it } from 'vitest';
import { manifestSchema } from '../src/manifest.js';

describe('manifestSchema', () => {
  it('akzeptiert ein gültiges Manifest', () => {
    const result = manifestSchema.safeParse({
      version: '0.1.0',
      contentBaseUrl: 'https://example.supabase.co/storage/v1/object/public/content',
      audioBaseUrl: 'https://example.supabase.co/storage/v1/object/public/audio',
      lessons: [
        {
          id: 'M01-01-01',
          file: 'M01-01-01.json',
          sha256: 'a'.repeat(64),
          updatedAt: '2026-09-19T00:00:00Z',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('lehnt eine nicht semver-förmige Version ab', () => {
    const result = manifestSchema.safeParse({
      version: '1',
      contentBaseUrl: 'https://example.com',
      audioBaseUrl: 'https://example.com',
      lessons: [],
    });
    expect(result.success).toBe(false);
  });

  it('lehnt eine zu kurze Prüfsumme ab', () => {
    const result = manifestSchema.safeParse({
      version: '0.1.0',
      contentBaseUrl: 'https://example.com',
      audioBaseUrl: 'https://example.com',
      lessons: [{ id: 'M01-01-01', file: 'M01-01-01.json', sha256: 'abc', updatedAt: '2026-09-19T00:00:00Z' }],
    });
    expect(result.success).toBe(false);
  });
});
