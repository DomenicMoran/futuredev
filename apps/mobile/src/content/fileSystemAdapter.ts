import type { ContentFs } from './types.js';

/**
 * Echte Implementierung ueber `expo-file-system`. Wird bewusst nicht von
 * `src/content/index.ts` statisch re-exportiert und nur per dynamischem
 * `import()` aus `contentFs.ts` geladen, aus demselben Grund wie
 * `src/data/sqliteDatabase.ts`: Vitest kann den Flow-Quelltext von
 * react-native (transitive Abhaengigkeit) nicht parsen.
 */
export async function createFileSystemContentFs(): Promise<ContentFs> {
  // expo-file-system@57's oberste Ebene ist die neue File/Directory-API ohne
  // `documentDirectory`/`getInfoAsync`/... Der alte, funktionsbasierte
  // Zugriff lebt jetzt unter dem Unterpfad "/legacy" (siehe auch
  // src/player/index.ts, dieselbe Falle dort dokumentiert).
  const FileSystem = await import('expo-file-system/legacy');
  const documentDirectory = FileSystem.documentDirectory ?? '';

  return {
    documentDirectory,
    async ensureDirectory(path: string) {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(path, { intermediates: true });
      }
    },
    async writeFile(path: string, contents: string) {
      await FileSystem.writeAsStringAsync(path, contents);
    },
    async readFile(path: string) {
      return FileSystem.readAsStringAsync(path);
    },
    async exists(path: string) {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    },
    async listDirectory(path: string) {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return [];
      return FileSystem.readDirectoryAsync(path);
    },
  };
}
