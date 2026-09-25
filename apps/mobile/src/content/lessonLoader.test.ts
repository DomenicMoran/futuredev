import { describe, expect, it } from 'vitest';
import { loadLesson } from './lessonLoader.js';
import type { ContentFs } from './types.js';

const emptyFs: ContentFs = {
  documentDirectory: 'file:///doc/',
  async readFile() {
    throw new Error('missing');
  },
  async writeFile() {
    throw new Error('read-only');
  },
  async exists() {
    return false;
  },
  async ensureDirectory() {
    // Test-Attrappe: leeres Dokumentverzeichnis.
  },
  async listDirectory() {
    return [];
  },
};

describe('loadLesson', () => {
  it('nutzt die gebuendelte Kopie, wenn die Lektion noch nicht im Dokumentverzeichnis liegt', async () => {
    const lesson = await loadLesson(emptyFs, 'M01-00-01', { bundledFallback: true });
    expect(lesson?.title).toBe('Was ein Computer tut');
  });
});
