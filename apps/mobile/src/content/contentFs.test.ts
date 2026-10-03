import { expect, it, vi } from 'vitest';
import type { ContentFs } from './types.js';

const create = vi.hoisted(() => vi.fn());
vi.mock('./fileSystemAdapter.js', () => ({ createFileSystemContentFs: create }));

it('shares one native filesystem across concurrent boot consumers', async () => {
  vi.resetModules();
  const fs = { documentDirectory: 'test/' } as ContentFs;
  create.mockResolvedValueOnce(fs);
  const { getContentFs } = await import('./contentFs.js');
  const instances = await Promise.all(Array.from({ length: 20 }, () => getContentFs()));
  expect(instances.every((instance) => instance === fs)).toBe(true);
  expect(create).toHaveBeenCalledTimes(1);
});
