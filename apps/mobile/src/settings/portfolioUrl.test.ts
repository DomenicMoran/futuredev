import { describe, expect, it } from 'vitest';
import { isValidPortfolioUrl } from './portfolioUrl.js';

describe('portfolio URL validation', () => {
  it('allows a blank optional link and absolute HTTP(S) links with a host', () => {
    expect(isValidPortfolioUrl('  ')).toBe(true);
    expect(isValidPortfolioUrl('https://example.org/project')).toBe(true);
    expect(isValidPortfolioUrl('http://localhost:3000')).toBe(true);
  });

  it.each(['https://', 'http://', 'https:///path', 'javascript:alert(1)', 'ftp://example.org', 'https://user:pass@example.org'])('rejects malformed or disallowed URL %s', (value) => {
    expect(isValidPortfolioUrl(value)).toBe(false);
  });
});
