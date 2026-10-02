// Einstellungen "Alles löschen" delegiert absichtlich an dieselbe DB-Instanz
// und Serialisierung wie alle App-Datenoperationen.
import { getDatabase } from '../data/db.js';
import { beginFlashcardReviewReset } from '../flashcards/reviews.js';

/**
 * Leert alle persönlichen Tabellen atomar über die zentrale Database-Fassade.
 */
export async function wipeAllTables(): Promise<void> {
  const flashcardReset = beginFlashcardReviewReset();
  try {
    await flashcardReset.ready;
    const db = await getDatabase();
    await db.transaction((transactionDb) => transactionDb.clearPersonalData());
  } finally {
    flashcardReset.release();
  }
}
