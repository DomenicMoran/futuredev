import { describe, expect, it } from 'vitest';
import { resolveColorScheme } from './colorScheme.js';

describe('resolveColorScheme', () => {
  it('folgt dem Systemfarbschema, wenn die Einstellung "system" ist', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('fällt auf hell zurück, wenn das System kein Farbschema liefert', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
  });

  it('überschreibt das Systemfarbschema bei einer festen Einstellung', () => {
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('light', 'dark')).toBe('light');
  });
});
