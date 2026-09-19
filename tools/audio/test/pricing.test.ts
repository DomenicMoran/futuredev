import { describe, expect, it } from 'vitest';
import { estimateCostByTier, PRICING_TIERS } from '../src/pricing.js';

describe('estimateCostByTier', () => {
  it('gibt fuer jeden Tarif eine Schaetzung zurueck', () => {
    const estimates = estimateCostByTier(10_000);
    expect(estimates).toHaveLength(PRICING_TIERS.length);
  });

  it('rechnet den USD-Betrag aus Zeichenpreis mal Zeichenzahl', () => {
    const [starter] = estimateCostByTier(30_000);
    expect(starter?.tier).toBe('Starter');
    expect(starter?.usd).toBeCloseTo(6, 2); // 30.000 Zeichen * 0,20 USD/1000 = 6 USD
  });

  it('meldet, ob eine Zeichenzahl in ein Monatskontingent passt', () => {
    const [starter] = estimateCostByTier(30_000);
    expect(starter?.fitsInOneMonth).toBe(true);
    const [starterOver] = estimateCostByTier(30_001);
    expect(starterOver?.fitsInOneMonth).toBe(false);
  });

  it('rechnet bei 0 Zeichen 0 USD', () => {
    const estimates = estimateCostByTier(0);
    expect(estimates.every((e) => e.usd === 0)).toBe(true);
  });
});
