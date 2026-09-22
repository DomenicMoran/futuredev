import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { markPortfolioExplained } from './markExplained.js';
import { listPublishedPortfolioItems } from './publishedPortfolio.js';

describe('markPortfolioExplained', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('setzt veröffentlichte Bausteine auf erklaert und behält url/baustein', async () => {
    const db = await getDatabase();
    await db.upsertPortfolioItem({
      id: 'P00',
      baustein: 'P00',
      status: 'veroeffentlicht',
      url: 'https://example.test/p00',
      updatedAt: '2026-09-19T10:00:00Z',
    });

    const ok = await markPortfolioExplained('P00');
    expect(ok).toBe(true);

    const rows = await db.listPortfolioItems();
    const row = rows.find((r) => r.id === 'P00');
    expect(row?.status).toBe('erklaert');
    expect(row?.baustein).toBe('P00');
    expect(row?.url).toBe('https://example.test/p00');
    expect(row?.updatedAt).not.toBe('2026-09-19T10:00:00Z');

    const published = await listPublishedPortfolioItems();
    expect(published.some((p) => p.id === 'P00')).toBe(false);
  });

  it('gibt false zurück, wenn der Baustein nicht veröffentlicht ist', async () => {
    const ok = await markPortfolioExplained('P00');
    expect(ok).toBe(false);
  });
});
