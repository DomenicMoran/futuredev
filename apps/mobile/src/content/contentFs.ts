import type { ContentFs } from './types.js';

let instance: ContentFs | null = null;

/** Nur fuer Tests: ersetzt die Implementierung durch eine Test-Attrappe. */
export function setContentFs(fs: ContentFs): void {
  instance = fs;
}

export async function getContentFs(): Promise<ContentFs> {
  if (!instance) {
    const { createFileSystemContentFs } = await import('./fileSystemAdapter.js');
    instance = await createFileSystemContentFs();
  }
  return instance;
}

export const CONTENT_DIR_NAME = 'content';
export const LESSONS_DIR_NAME = 'lessons';
