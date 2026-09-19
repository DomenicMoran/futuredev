// Nur noch eine Aufgabe: "Alles löschen" in den Einstellungen (AP-3.5,
// Punkt 4). Alles andere läuft inzwischen über Agent B's `src/data/`
// (`getDatabase()`), die zu Beginn dieses Auftrags noch nicht existierte.
// Dieselbe Datenbankdatei (`futuredev.db`), dieselben Tabellen- und
// Spaltennamen wie `src/data/sqliteDatabase.ts` (aus
// datenmodell.md, Abschnitt b), deshalb unproblematisch nebeneinander.
//
// Nur ein Typ-Import (wird von TypeScript vollständig entfernt): das
// tatsächliche Modul wird unten in open() dynamisch geladen, damit reine
// Logik-Tests (Vitest, Node ohne React-Native-Laufzeit) diese Datei
// importieren können, ohne dass Node das native expo-sqlite-Modul auflösen muss.
import type * as SQLite from 'expo-sqlite';
import { EXPORTABLE_TABLES } from './types.js';

const DB_NAME = 'futuredev.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const { openDatabaseAsync } = await import('expo-sqlite');
  return openDatabaseAsync(DB_NAME);
}

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

// Nur für Tests: erzwingt einen frischen Verbindungsaufbau.
export function resetDbForTests(): void {
  dbPromise = null;
}

/**
 * Leert alle App-Tabellen (Einstellungen "Alles löschen"). Tabellennamen
 * kommen ausschließlich aus der festen Liste `EXPORTABLE_TABLES`, nie aus
 * einer Nutzereingabe, sonst wäre das eine SQL-Injection-Lücke.
 */
export async function wipeAllTables(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of EXPORTABLE_TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
