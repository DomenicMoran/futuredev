import { describe, expect, it, vi } from 'vitest';
import { cleanupImportCopy, importThenHydrate } from './importLifecycle.js';

describe('import commit/hydrate phase distinction', () => {
  it('reports persisted data when hydration fails after commit', async () => {
    const commit = vi.fn(async () => undefined);
    const result = await importThenHydrate('{}', commit, async () => { throw new Error('hydrate failure'); });
    expect(result).toEqual({ phase: 'hydrate-failed', error: expect.objectContaining({ message: 'hydrate failure' }) });
    expect(commit).toHaveBeenCalledOnce();
  });
  it('preserves validation/commit failure independently of later cache cleanup failure', async () => {
    const result = await importThenHydrate('{}', async () => { throw new Error('invalid backup'); }, vi.fn());
    const cleanupSucceeded = await cleanupImportCopy(async () => { throw new Error('cache cleanup'); });
    expect(result).toEqual({ phase: 'commit-failed', error: expect.objectContaining({ message: 'invalid backup' }) });
    expect(cleanupSucceeded).toBe(false);
  });
});
