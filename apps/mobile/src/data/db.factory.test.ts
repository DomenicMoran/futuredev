import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDatabase } from './memoryDatabase.js';

const factories = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./sqliteDatabase.js', () => ({ createSqliteDatabase: factories.create }));

describe('default database factory recovery', () => {
  beforeEach(() => { vi.resetModules(); factories.create.mockReset(); });

  it('retries after one factory rejection rather than retaining a rejected promise', async () => {
    const db = createMemoryDatabase();
    factories.create.mockRejectedValueOnce(new Error('transient open failure')).mockReturnValueOnce(db);
    const { getDatabase } = await import('./db.js');
    await expect(getDatabase()).rejects.toThrow('transient open failure');
    expect(await getDatabase()).toBe(db);
    expect(factories.create).toHaveBeenCalledTimes(2);
  });

  it('ignores an old factory rejection after a memory database replaces it', async () => {
    let rejectFactory!: (error: Error) => void;
    factories.create.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFactory = reject; }));
    const { getDatabase, setDatabase } = await import('./db.js');
    const oldRequest = getDatabase();
    const replacement = createMemoryDatabase();
    setDatabase(replacement);
    rejectFactory(new Error('stale open failure'));
    await expect(oldRequest).resolves.toBe(replacement);
    expect(factories.create).toHaveBeenCalledTimes(1);
  });

  it('reroutes an old initializer rejection to the replacement database', async () => {
    const { getDatabase, setDatabase } = await import('./db.js');
    const oldDb = createMemoryDatabase();
    let rejectInit!: (error: Error) => void;
    oldDb.init = () => new Promise<void>((_resolve, reject) => { rejectInit = reject; });
    setDatabase(oldDb);
    const staleCaller = getDatabase();
    const replacement = createMemoryDatabase();
    setDatabase(replacement);
    rejectInit(new Error('stale initialization failure'));
    await expect(staleCaller).resolves.toBe(replacement);
  });
});
