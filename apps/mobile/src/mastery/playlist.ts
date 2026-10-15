import { getDatabase } from '../data/db.js';
/** One dedicated list, updated atomically; never touches user-created playlists. */
export async function saveReviewPlaylist(ids: string[]): Promise<string> {
  if (!ids.length) throw new Error('Keine Wiederholungslektionen vorhanden.');
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const stored = await tx.getSetting('mastery_playlist_v1');
    let playlist = (await tx.listPlaylists()).find((p) => p.id === stored);
    if (!playlist) playlist = await tx.createPlaylist('Lernkreislauf · Wiederholung');
    const playlistId = playlist.id;
    await tx.restorePlaylist(
      { ...playlist, updatedAt: new Date().toISOString() },
      [...new Set(ids)].map((lessonId, position) => ({
        playlistId: playlistId,
        lessonId,
        position,
      })),
    );
    await tx.setSetting('mastery_playlist_v1', playlist.id);
    return playlist.id;
  });
}
