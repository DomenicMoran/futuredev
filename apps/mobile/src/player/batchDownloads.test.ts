import { describe, expect, it, vi } from 'vitest';
import { createBatchDownloads } from './batchDownloads.js';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { resolve, promise }; }
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('batch downloads', () => {
  it('drains active transfers and clears all queue state on a personal-data reset', async () => {
    const gate = deferred<'downloaded' | 'cancelled'>();
    const download = vi.fn(() => gate.promise);
    const batch = createBatchDownloads({ isDownloaded: async () => false, download, cancel: async () => { gate.resolve('cancelled'); } }, 1);
    const run = batch.start(['a', 'b']); await tick();
    await batch.reset(); await run;
    expect(download).toHaveBeenCalledTimes(1);
    expect(batch.getSnapshot()).toEqual({ running: false, items: {} });
  });
  it('deduplicates, skips verified downloads and bounds concurrency', async () => {
    const gates = new Map<string, ReturnType<typeof deferred<'downloaded'>>>();
    let active = 0; let peak = 0;
    const download = vi.fn(async (id: string) => {
      active++; peak = Math.max(peak, active);
      const gate = deferred<'downloaded'>(); gates.set(id, gate);
      const result = await gate.promise; active--; return result;
    });
    const batch = createBatchDownloads({ isDownloaded: async (id) => id === 'existing', download, cancel: async () => undefined }, 2);
    const done = batch.start(['existing', 'a', 'a', 'b', 'c']);
    await tick();
    expect(peak).toBe(2); expect(download).toHaveBeenCalledTimes(2);
    gates.get('a')?.resolve('downloaded'); await tick();
    expect(download).toHaveBeenCalledTimes(3);
    gates.get('b')?.resolve('downloaded'); gates.get('c')?.resolve('downloaded'); await done;
    expect(batch.getSnapshot()).toEqual({ running: false, items: { existing: 'skipped', a: 'downloaded', b: 'downloaded', c: 'downloaded' } });
    expect(peak).toBe(2);
  });
  it('cancels active work and never starts queued work, then retries unfinished items', async () => {
    const gate = deferred<'downloaded' | 'cancelled'>();
    const download = vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValue('downloaded');
    const cancel = vi.fn(async () => { gate.resolve('cancelled'); });
    const batch = createBatchDownloads({ isDownloaded: async () => false, download, cancel }, 1);
    const done = batch.start(['a', 'b']); await tick();
    await batch.cancel(); await done;
    expect(cancel).toHaveBeenCalledWith('a'); expect(download).toHaveBeenCalledTimes(1);
    expect(batch.getSnapshot().items).toEqual({ a: 'cancelled', b: 'cancelled' });
    await batch.retry(); expect(download).toHaveBeenCalledTimes(3);
    expect(batch.getSnapshot().items).toEqual({ a: 'downloaded', b: 'downloaded' });
  });
  it('cancellation during existing-file verification cannot start a transfer', async () => {
    const check = deferred<boolean>(); const download = vi.fn(async () => 'downloaded' as const);
    const batch = createBatchDownloads({ isDownloaded: () => check.promise, download, cancel: async () => undefined });
    const done = batch.start(['a']); await batch.cancel(); check.resolve(false); await done;
    expect(download).not.toHaveBeenCalled(); expect(batch.getSnapshot().items.a).toBe('cancelled');
  });
  it('contains failures, continues other work and retries only failed work', async () => {
    const download = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('downloaded');
    const batch = createBatchDownloads({ isDownloaded: async () => false, download, cancel: async () => undefined }, 1);
    const listener = vi.fn(); const unsubscribe = batch.subscribe(listener);
    await batch.start(['a', 'b']); expect(batch.getSnapshot().items).toEqual({ a: 'failed', b: 'downloaded' });
    unsubscribe(); const calls = listener.mock.calls.length;
    await batch.retry(); expect(download.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'a']);
    expect(listener).toHaveBeenCalledTimes(calls);
  });
  it('rejects overlapping batch starts without replacing their progress', async () => {
    const gate = deferred<'downloaded'>();
    const batch = createBatchDownloads({ isDownloaded: async () => false, download: () => gate.promise, cancel: async () => undefined });
    const done = batch.start(['a']); await batch.start(['b']);
    expect(Object.keys(batch.getSnapshot().items)).toEqual(['a']);
    gate.resolve('downloaded'); await done;
  });
});

