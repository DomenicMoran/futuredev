// Pfade fuer heruntergeladene Hördateien, als reine Funktionen (kein
// expo-file-system-Zugriff hier, siehe fileSystemAdapter.ts fuer den Grund:
// Vitest kann den RN-Quelltext nicht parsen). Ablage unter
// documentDirectory/audio/<lessonId>.mp3 bzw. .cues.json.
import { DOWNLOAD_DIR_NAME } from './types.js';

export function downloadDirPath(documentDirectory: string): string {
  return `${documentDirectory}${DOWNLOAD_DIR_NAME}/`;
}

export function downloadedAudioPath(documentDirectory: string, lessonId: string): string {
  return `${downloadDirPath(documentDirectory)}${lessonId}.mp3`;
}

export function downloadedCuesPath(documentDirectory: string, lessonId: string): string {
  return `${downloadDirPath(documentDirectory)}${lessonId}.cues.json`;
}

export function remoteAudioUrl(audioBaseUrl: string, lessonId: string): string {
  return `${audioBaseUrl.replace(/\/$/, '')}/${lessonId}.mp3`;
}

export function remoteCuesUrl(audioBaseUrl: string, lessonId: string): string {
  return `${audioBaseUrl.replace(/\/$/, '')}/${lessonId}.cues.json`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
