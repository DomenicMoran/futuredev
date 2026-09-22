import portfolioFile from '../../../../content/portfolio.json';
import { getDatabase } from '../data/db.js';

export interface PublishedPortfolioItem {
  id: string;
  title: string;
  goal: string;
  proof: string;
  url: string | null;
  baustein: string;
}

/** Portfolio-Bausteine mit SQLite-Status `veroeffentlicht` (noch nicht erklärt). */
export async function listPublishedPortfolioItems(): Promise<PublishedPortfolioItem[]> {
  const db = await getDatabase();
  const rows = await db.listPortfolioItems();
  const rowByBaustein = new Map(rows.map((row) => [row.baustein, row]));

  return portfolioFile.items.flatMap((item) => {
    const row = rowByBaustein.get(item.id);
    if (row?.status !== 'veroeffentlicht') return [];
    return [
      {
        id: item.id,
        title: item.title,
        goal: item.goal,
        proof: item.proof,
        url: row.url,
        baustein: row.baustein,
      },
    ];
  });
}
