import { describe, expect, it, vi } from 'vitest';
import type { ContentSnapshot } from '../content/generation.js';
import { downloadedLessonIds } from './downloadedBatch.js';

describe('downloadedLessonIds', () => {
  it('passes one pinned generation through every status check and resolves a whole batch', async () => {
    const snapshot = { root: 'A/', manifest: null, modules: null, generationId: 'A', pointerSequence: 1 } satisfies ContentSnapshot;
    const check = vi.fn(async (id: string, pinned: ContentSnapshot) => {
      expect(pinned).toBe(snapshot);
      if (id === 'M01-01-03') throw new Error('corrupt download marker');
      return id.endsWith('01');
    });
    const ids = Array.from({ length: 197 }, (_, index) => `M01-01-${String(index + 1).padStart(2, '0')}`);
    const downloaded = await downloadedLessonIds(ids, snapshot, check);
    expect(check).toHaveBeenCalledTimes(197);
    expect([...downloaded]).toEqual(ids.filter((id) => id.endsWith('01')));
  });
});
