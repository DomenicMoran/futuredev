import type { ContentFs } from './types.js';

let instance: ContentFs | null = null;
let initializing: Promise<ContentFs> | null = null;

/** Nur fuer Tests: ersetzt die Implementierung durch eine Test-Attrappe. */
export function setContentFs(fs: ContentFs): void {
  instance = fs;
}

export async function getContentFs(): Promise<ContentFs> {
  if (instance) return instance;
  initializing ??= import('./fileSystemAdapter.js')
    .then(({ createFileSystemContentFs }) => createFileSystemContentFs())
    .then((fs) => { instance ??= fs; return instance; })
    .finally(() => { initializing = null; });
  return initializing;
}

export const CONTENT_DIR_NAME = 'content';
export const LESSONS_DIR_NAME = 'lessons';
