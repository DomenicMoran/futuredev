import type { Database } from './types.js';
import { createMemoryDatabase } from './memoryDatabase.js';

// Einzige Instanz fuer die Laufzeit der App. `setDatabase` erlaubt Tests, eine
// `MemoryDatabase` einzusetzen, bevor irgendetwas `getDatabase()` aufruft.
// `sqliteDatabase.ts` (echtes `expo-sqlite`) wird bewusst per dynamischem
// `import()` nachgeladen statt oben statisch importiert: Vitest laeuft in
// einer reinen Node-Umgebung, die den Flow-Quelltext von react-native (eine
// transitive Abhaengigkeit von expo-sqlite) nicht parsen kann. Ein
// Top-Level-Import wuerde also jeden Test brechen, der irgendetwas aus
// `src/data` importiert, nicht nur SQLite-spezifische Tests.
let instance: Database | null = null;
let instancePromise: Promise<Database> | null = null;
let initPromise: Promise<void> | null = null;

/** Nur fuer Tests: ersetzt die Datenbank (etwa durch `createMemoryDatabase()`). */
export function setDatabase(db: Database): void {
  instance = db;
  instancePromise = null;
  initPromise = null;
}

async function createDefaultDatabase(): Promise<Database> {
  const { createSqliteDatabase } = await import('./sqliteDatabase.js');
  return createSqliteDatabase();
}

/**
 * Liefert die aktive Datenbank und stellt sicher, dass sie initialisiert
 * (Migrationen gelaufen) ist, bevor sie zurueckgegeben wird.
 */
export async function getDatabase(): Promise<Database> {
  if (!instancePromise) {
    instancePromise = createDefaultDatabase().then((db) => {
      instance = db;
      return db;
    });
  }
  const db = instance ?? (await instancePromise);
  if (!initPromise) {
    initPromise = db.init().catch((err: unknown) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
  return db;
}

/** Nur fuer Tests: alles auf eine frische Speicher-Datenbank zuruecksetzen. */
export function resetToMemoryDatabase(): Database {
  const db = createMemoryDatabase();
  setDatabase(db);
  return db;
}
