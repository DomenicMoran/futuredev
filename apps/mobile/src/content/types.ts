import type { Manifest, ModulesFile, Lesson } from '@futuredev/content-schema';

/**
 * Dateisystem-Zugriff hinter einer eigenen Schnittstelle (wie `Database` in
 * `src/data`), damit Manifest-Diff, Erststart-Kopie und Ladefunktionen ohne
 * `expo-file-system` getestet werden koennen (Vitest kann RN-Quelltext nicht
 * parsen, siehe `src/data/db.ts`).
 */
export interface ContentFs {
  readonly documentDirectory: string;
  ensureDirectory(path: string): Promise<void>;
  writeFile(path: string, contents: string): Promise<void>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  listDirectory(path: string): Promise<string[]>;
}

export type ContentLoadStatus = 'ok' | 'offline' | 'error';

export interface ContentState {
  status: ContentLoadStatus;
  manifest: Manifest | null;
  modules: ModulesFile | null;
  lastUpdatedAt: string | null;
  hasNewLessons: boolean;
  message?: string;
}

export interface LessonWithStatus {
  lesson: Lesson;
}
