import { getDatabase } from './db.js';
import type { PlaylistItemRow, PlaylistRow } from './types.js';

export async function listPlaylists(): Promise<PlaylistRow[]> {
  const db = await getDatabase();
  return db.listPlaylists();
}

export async function createPlaylist(name: string): Promise<PlaylistRow> {
  const db = await getDatabase();
  return db.createPlaylist(name.trim());
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.renamePlaylist(id, name.trim());
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDatabase();
  await db.deletePlaylist(id);
}

export async function listPlaylistItems(playlistId: string): Promise<PlaylistItemRow[]> {
  const db = await getDatabase();
  return db.listPlaylistItems(playlistId);
}

export async function addLessonToPlaylist(playlistId: string, lessonId: string): Promise<void> {
  const db = await getDatabase();
  await db.addPlaylistItem(playlistId, lessonId);
}

export async function removePlaylistItem(playlistId: string, lessonId: string): Promise<void> {
  const db = await getDatabase();
  await db.removePlaylistItem(playlistId, lessonId);
}
