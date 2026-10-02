import { describe, expect, it, vi } from 'vitest';
import type { ContentSnapshot } from '../content/generation.js';
import { setContentFs } from '../content/contentFs.js';
import type { ContentFs } from '../content/types.js';
import { lessonIdsFromLessonInModule, lessonIdsInModule } from './moduleLessonIds.js';

function fsSpy() {
  const fs: ContentFs = {
    documentDirectory: 'file:///docs/', ensureDirectory: vi.fn(async () => undefined), writeFile: vi.fn(async () => undefined),
    moveFile: vi.fn(async () => undefined), getFileSize: vi.fn(async () => null), readFilePrefixBase64: vi.fn(async () => ''),
    readFile: vi.fn(async () => ''), exists: vi.fn(async () => false), listDirectory: vi.fn(async () => []),
  };
  setContentFs(fs);
  return fs;
}

describe('module lesson IDs use the caller generation', () => {
  it('does not reload the active pointer for a batch and preserves module ordering', async () => {
    const fs = fsSpy();
    const snapshot = {
      root: 'A/', pointerSequence: 4, generationId: 'A', modules: null,
      manifest: { lessons: [
        { id: 'M02-01-01' }, { id: 'M01-01-02' }, { id: 'M01-02-01' }, { id: 'M01-01-01' },
      ] },
    } as unknown as ContentSnapshot;
    expect(await lessonIdsInModule('M01', snapshot)).toEqual(['M01-01-01', 'M01-01-02', 'M01-02-01']);
    expect(await lessonIdsFromLessonInModule('M01-01-02', snapshot)).toEqual(['M01-01-02', 'M01-02-01']);
    expect(fs.listDirectory).not.toHaveBeenCalled();
  });
});
