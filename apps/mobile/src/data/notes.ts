import { getDatabase } from './db.js';
import type { NoteRow } from './types.js';

export async function listNotes(lessonId?: string): Promise<NoteRow[]> {
  const db = await getDatabase();
  return db.listNotes(lessonId);
}

/** Legt eine Notiz an oder aktualisiert sie (gleiche `id` = Aktualisierung). */
export async function saveNote(id: string, lessonId: string, body: string): Promise<NoteRow> {
  const db = await getDatabase();
  const existing = (await db.listNotes(lessonId)).find((n) => n.id === id);
  const now = new Date().toISOString();
  const row: NoteRow = {
    id,
    lessonId,
    body,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.upsertNote(row);
  return row;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.deleteNote(id);
}
