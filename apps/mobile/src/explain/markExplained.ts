import { getDatabase } from '../data/db.js';

/**
 * Setzt einen veröffentlichten Baustein auf `erklaert`, ohne id, baustein oder
 * url zu verlieren (updatedAt wird auf den Abschlusszeitpunkt gesetzt).
 */
export async function markPortfolioExplained(portfolioItemId: string): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.listPortfolioItems();
  const existing = rows.find((row) => row.id === portfolioItemId || row.baustein === portfolioItemId);
  if (!existing || existing.status !== 'veroeffentlicht') {
    return false;
  }

  await db.upsertPortfolioItem({
    id: existing.id,
    baustein: existing.baustein,
    status: 'erklaert',
    url: existing.url,
    updatedAt: new Date().toISOString(),
  });
  return true;
}
