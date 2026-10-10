const listeners = new Set<() => void>();
export function subscribeProgressChanged(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function notifyProgressChanged(): void { for (const listener of listeners) { try { listener(); } catch { /* UI subscribers must not turn a committed write into a reported failure. */ } } }
