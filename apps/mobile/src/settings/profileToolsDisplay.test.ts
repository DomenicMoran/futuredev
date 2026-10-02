import { describe, expect, it } from 'vitest';
import portfolioFile from '../../../../content/portfolio.json';
import type { PortfolioDisplayItem, ProfileData } from './profile.js';
import { resolveProfileToolsViewModel, shouldShowProfileToolsError } from './profileToolsDisplay.js';

const staticPortfolio: PortfolioDisplayItem[] = portfolioFile.items.map((item) => ({
  id: item.id,
  title: item.title,
  goal: item.goal,
  status: 'offen',
  url: null,
}));

function firstStaticPortfolioItem(): PortfolioDisplayItem {
  const item = staticPortfolio[0];
  if (!item) {
    throw new Error('content/portfolio.json must contain at least one item');
  }
  return item;
}

function profileWithPortfolio(status: PortfolioDisplayItem['status'], url: string | null): ProfileData {
  return {
    moduleProgress: [],
    readiness: { percent: 0, missing: [] },
    portfolio: [{ ...firstStaticPortfolioItem(), status, url }],
    career: [],
    notes: [],
    bookmarks: [],
  };
}

describe('shouldShowProfileToolsError', () => {
  it('suppresses the error banner while tools are still loading', () => {
    expect(shouldShowProfileToolsError(true, true)).toBe(false);
    expect(shouldShowProfileToolsError(false, true)).toBe(false);
    expect(shouldShowProfileToolsError(true, false)).toBe(true);
  });
});

describe('resolveProfileToolsViewModel', () => {
  it('shows loading placeholders without treating missing tools as an error', () => {
    const view = resolveProfileToolsViewModel({
      tools: null,
      profile: null,
      toolsLoading: true,
      toolsError: false,
      staticPortfolio,
      staticCareer: [],
    });
    expect(view.showToolsLoading).toBe(true);
    expect(view.showToolsError).toBe(false);
    expect(view.portfolio).toHaveLength(staticPortfolio.length);
    expect(view.interactive).toBe(false);
  });

  it('does not show an error while a retry fetch is in flight', () => {
    const view = resolveProfileToolsViewModel({
      tools: null,
      profile: null,
      toolsLoading: true,
      toolsError: true,
      staticPortfolio,
      staticCareer: [],
    });
    expect(view.showToolsLoading).toBe(true);
    expect(view.showToolsError).toBe(false);
  });
  it('prefers the independent tools snapshot over stale profile portfolio data', () => {
    const view = resolveProfileToolsViewModel({
      tools: {
        portfolio: [{ ...firstStaticPortfolioItem(), status: 'erklaert', url: 'https://example.com' }],
        career: [],
      },
      profile: profileWithPortfolio('offen', null),
      toolsLoading: false,
      toolsError: false,
      staticPortfolio,
      staticCareer: [],
    });
    expect(view.portfolio[0]?.status).toBe('erklaert');
    expect(view.portfolio[0]?.url).toBe('https://example.com');
    expect(view.interactive).toBe(true);
  });

  it('keeps the latest tools snapshot visible when profile refresh fails', () => {
    const view = resolveProfileToolsViewModel({
      tools: {
        portfolio: [{ ...firstStaticPortfolioItem(), status: 'erklaert', url: 'https://example.com' }],
        career: [],
      },
      profile: profileWithPortfolio('offen', null),
      toolsLoading: false,
      toolsError: false,
      staticPortfolio,
      staticCareer: [],
    });
    expect(view.portfolio[0]?.status).toBe('erklaert');
    expect(view.showToolsError).toBe(false);
  });

  it('does not fall back to profile portfolio when tools failed without a snapshot', () => {
    const view = resolveProfileToolsViewModel({
      tools: null,
      profile: profileWithPortfolio('veroeffentlicht', 'https://stale.example'),
      toolsLoading: false,
      toolsError: true,
      staticPortfolio,
      staticCareer: [],
    });
    expect(view.portfolio).toEqual([]);
    expect(view.showToolsError).toBe(true);
    expect(view.interactive).toBe(false);
  });
});
