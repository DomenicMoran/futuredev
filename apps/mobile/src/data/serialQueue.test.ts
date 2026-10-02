import { describe, expect, it } from 'vitest';
import { runSerialized } from './serialQueue.js';

describe('SQLite FIFO operation queue', () => {
  it('holds a legit write behind the full transaction and releases it after rollback', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const importer = runSerialized(async () => {
      order.push('import-begin');
      await gate;
      order.push('import-rollback');
      throw new Error('rollback');
    });
    const writer = runSerialized(async () => { order.push('local-write-commit'); });
    await Promise.resolve();
    expect(order).toEqual(['import-begin']);
    release();
    await expect(importer).rejects.toThrow('rollback');
    await writer;
    expect(order).toEqual(['import-begin', 'import-rollback', 'local-write-commit']);
  });
});
