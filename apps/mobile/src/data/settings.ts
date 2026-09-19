import { getDatabase } from './db.js';

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDatabase();
  return db.getSetting(key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.setSetting(key, value);
}

/** Liefert eine zufaellige Installations-Kennung (`install_id`), legt sie beim ersten Aufruf an. */
export async function getOrCreateInstallId(): Promise<string> {
  const existing = await getSetting('install_id');
  if (existing) return existing;
  const id = generateUuid();
  await setSetting('install_id', id);
  return id;
}

function generateUuid(): string {
  // Kein Personenbezug, keine Geraete-ID: reiner Zufallswert (siehe
  // datenmodell.md, Abschnitt d). `crypto.randomUUID` ist in Hermes vorhanden;
  // Rueckfall auf Math.random fuer Testumgebungen ohne `crypto`.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
