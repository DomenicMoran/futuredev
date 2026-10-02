import { describe, expect, it } from 'vitest';
import {
  PORTFOLIO_EDITOR_TEST_IDS,
  portfolioEditorLayoutStyles,
  portfolioEditorSheetLayout,
} from './ichPortfolioEditorLayout.js';

describe('portfolio editor modal layout (360dp / 200% font reachability)', () => {
  it('keeps stable action and field test IDs', () => {
    expect(PORTFOLIO_EDITOR_TEST_IDS.modal).toBe('portfolio-editor-modal');
    expect(PORTFOLIO_EDITOR_TEST_IDS.urlInput).toBe('portfolio-url-input');
    expect(PORTFOLIO_EDITOR_TEST_IDS.save).toBe('portfolio-save');
    expect(PORTFOLIO_EDITOR_TEST_IDS.cancel).toBe('portfolio-cancel');
    expect(PORTFOLIO_EDITOR_TEST_IDS.statusPrefix).toBe('portfolio-status-');
  });

  it('uses a bounded sheet with scrollable body and fixed footer outside scroll', () => {
    expect(portfolioEditorSheetLayout.footerOutsideScroll).toBe(true);
    expect(portfolioEditorSheetLayout.keyboardAvoiding).toBe(true);
    expect(portfolioEditorSheetLayout.maxSheetHeightRatio).toBeGreaterThan(0.9);
    expect(portfolioEditorSheetLayout.maxSheetHeightRatio).toBeLessThanOrEqual(0.94);

    expect(portfolioEditorLayoutStyles.modalCard.maxHeight).toBe('94%');
    expect(portfolioEditorLayoutStyles.modalCard.overflow).toBe('hidden');
    expect(portfolioEditorLayoutStyles.modalColumn.minHeight).toBe(0);
    expect(portfolioEditorLayoutStyles.modalScroll.minHeight).toBe(0);
    expect(portfolioEditorLayoutStyles.modalScroll.flexShrink).toBe(1);
    expect(portfolioEditorLayoutStyles.modalFooter.flexShrink).toBe(0);
  });
});
