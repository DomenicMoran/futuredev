import { describe, expect, it } from 'vitest';
import { cleanupPickedCacheAsset, cleanupPrivateExportCache } from './privateCache.js';

function fakeFs(names: string[]) {
  const deleted: string[] = [];
  return {
    deleted,
    async getInfoAsync() { return { exists: true }; },
    async readDirectoryAsync() { return names; },
    async deleteAsync(path: string) { deleted.push(path); },
  };
}

describe('private cache cleanup', () => {
  it('deletes app-owned exports and DocumentPicker copies but leaves unrelated/external cache files', async () => {
    const fs = fakeFs(['futuredev-export-1790331171602.json', 'DocumentPicker', 'unrelated.json']);
    await cleanupPrivateExportCache('file:///app/cache/', fs);
    expect(fs.deleted).toEqual(['file:///app/cache/futuredev-export-1790331171602.json', 'file:///app/cache/DocumentPicker']);
  });

  it('only deletes picker URIs inside the app cache, and propagates cleanup errors', async () => {
    const fs = fakeFs([]);
    await expect(cleanupPickedCacheAsset('content://drive/document/1', 'file:///app/cache/', fs)).resolves.toBe(false);
    await expect(cleanupPickedCacheAsset('file:///app/cache/DocumentPicker/one.json', 'file:///app/cache/', fs)).resolves.toBe(true);
    const broken = { ...fakeFs(['futuredev-export-old.json']), async deleteAsync() { throw new Error('cleanup failed'); } };
    await expect(cleanupPrivateExportCache('file:///app/cache/', broken)).rejects.toThrow('cleanup failed');
  });
});
