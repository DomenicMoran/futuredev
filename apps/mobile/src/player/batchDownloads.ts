export type BatchItemStatus = 'queued' | 'downloading' | 'downloaded' | 'skipped' | 'failed' | 'cancelled';
export interface BatchDownloadState { running: boolean; items: Record<string, BatchItemStatus> }
interface Dependencies {
  isDownloaded(id: string): Promise<boolean>;
  download(id: string): Promise<'downloaded' | 'cancelled'>;
  cancel(id: string): Promise<void>;
}

/** Session-owned queue: navigation never interrupts an explicitly requested batch. */
export function createBatchDownloads(deps: Dependencies, concurrency = 2) {
  let state: BatchDownloadState = { running: false, items: {} };
  let cancelled = false;
  let resetting = false;
  let activeRun: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (items = state.items, running = state.running) => {
    state = { items, running };
    for (const listener of listeners) listener();
  };
  const update = (id: string, status: BatchItemStatus) => publish({ ...state.items, [id]: status });
  const run = async (ids: readonly string[]): Promise<void> => {
    if (state.running) return;
    const queue = [...new Set(ids)];
    if (!queue.length) return;
    cancelled = false;
    publish(Object.fromEntries(queue.map((id) => [id, 'queued'])), true);
    const worker = async () => {
      while (queue.length && !cancelled) {
        const id = queue.shift();
        if (!id) continue;
        try {
          const exists = await deps.isDownloaded(id);
          if (cancelled) { update(id, 'cancelled'); continue; }
          if (exists) { update(id, 'skipped'); continue; }
          update(id, 'downloading');
          const result = await deps.download(id);
          update(id, result);
        } catch {
          update(id, cancelled ? 'cancelled' : 'failed');
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(4, Math.floor(concurrency) || 1)) }, worker));
    publish(state.items, false);
  };
  const start = (ids: readonly string[]): Promise<void> => {
    if (state.running || resetting) return Promise.resolve();
    const task = run(ids);
    activeRun = task;
    return task;
  };
  const cancel = async () => {
    if (!state.running) return;
    cancelled = true;
    const active = Object.keys(state.items).filter((id) => state.items[id] === 'downloading');
    publish(Object.fromEntries(Object.entries(state.items).map(([id, status]) => [id, status === 'queued' ? 'cancelled' : status])));
    await Promise.all(active.map((id) => deps.cancel(id).catch(() => undefined)));
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    retry: () => start(Object.keys(state.items).filter((id) => state.items[id] === 'failed' || state.items[id] === 'cancelled')),
    cancel,
    reset: async () => { resetting = true; try { await cancel(); await activeRun; publish({}, false); } finally { resetting = false; } },
  };
}

// Lazy native boundary keeps the scheduler independently testable.
export const batchDownloads = createBatchDownloads({
  isDownloaded: async (id) => (await import('./index.js')).isDownloaded(id),
  download: async (id) => (await import('./index.js')).downloadLesson(id),
  cancel: async (id) => (await import('./index.js')).cancelDownload(id),
});
