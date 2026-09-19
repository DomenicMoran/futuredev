import { describe, expect, it } from 'vitest';
import { computeReadiness } from '../src/readiness.js';

describe('computeReadiness', () => {
  it('gibt 0 zurück, wenn nichts erreicht ist', () => {
    const result = computeReadiness({
      passedCoreModulesCount: 0,
      totalCoreModulesCount: 10,
      publishedPortfolioItemsCount: 0,
      totalPortfolioItemsCount: 7,
      completedCareerChecklistCount: 0,
      totalCareerChecklistCount: 4,
    });
    expect(result.percent).toBe(0);
    expect(result.missing).toHaveLength(3);
  });

  it('gibt 100 zurück, wenn alle drei Anteile vollständig sind', () => {
    const result = computeReadiness({
      passedCoreModulesCount: 10,
      totalCoreModulesCount: 10,
      publishedPortfolioItemsCount: 7,
      totalPortfolioItemsCount: 7,
      completedCareerChecklistCount: 4,
      totalCareerChecklistCount: 4,
    });
    expect(result.percent).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('gewichtet die drei Anteile zu je einem Drittel', () => {
    const result = computeReadiness({
      passedCoreModulesCount: 10,
      totalCoreModulesCount: 10,
      publishedPortfolioItemsCount: 0,
      totalPortfolioItemsCount: 7,
      completedCareerChecklistCount: 0,
      totalCareerChecklistCount: 4,
    });
    expect(result.percent).toBeCloseTo(100 / 3, 5);
    expect(result.missing).toHaveLength(2);
  });

  it('lehnt Gewichte ab, die sich nicht zu 1 summieren', () => {
    expect(() =>
      computeReadiness({
        passedCoreModulesCount: 1,
        totalCoreModulesCount: 1,
        publishedPortfolioItemsCount: 1,
        totalPortfolioItemsCount: 1,
        completedCareerChecklistCount: 1,
        totalCareerChecklistCount: 1,
        weights: { modules: 0.5, portfolio: 0.5, career: 0.5 },
      }),
    ).toThrow();
  });
});
