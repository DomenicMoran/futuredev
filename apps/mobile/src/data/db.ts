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
let generation = 0;

/** Nur fuer Tests: ersetzt die Datenbank (etwa durch `createMemoryDatabase()`). */
export function setDatabase(db: Database): void {
  generation += 1;
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
  const requestedGeneration = generation;
  if (!instance && !instancePromise) {
    const creating = createDefaultDatabase().then((db) => {
      if (generation !== requestedGeneration) return getDatabase();
      if (!instance) instance = db;
      return db;
    }).catch((err: unknown) => {
      if (instancePromise === creating) instancePromise = null;
      if (generation !== requestedGeneration) return getDatabase();
      throw err;
    });
    instancePromise = creating;
  }
  let db = instance;
  if (!db) db = await instancePromise;
  // A test or app setup can replace the database while a native factory/init
  // is pending. Never return the stale connection to a caller after reset.
  if (generation !== requestedGeneration) return getDatabase();
  db = instance ?? db;
  if (!db) throw new Error('Datenbank konnte nicht initialisiert werden');
  if (!initPromise) {
    const initializing = db;
    initPromise = initializing.init().catch((err: unknown) => {
      // A replacement DB may be installed while this generation initializes.
      // Its callers should continue below to the generation check and retry;
      // do not report the stale initializer's failure or clear the replacement.
      if (generation !== requestedGeneration) return;
      if (generation === requestedGeneration && instance === initializing) initPromise = null;
      throw err;
    });
  }
  await initPromise;
  if (generation !== requestedGeneration) return getDatabase();
  return instance ?? db;
}

/** Nur fuer Tests: alles auf eine frische Speicher-Datenbank zuruecksetzen. */
export function resetToMemoryDatabase(): Database {
  const db = createMemoryDatabase();
  setDatabase(db);
  return db;
}
