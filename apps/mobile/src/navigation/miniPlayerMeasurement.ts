import { useSyncExternalStore } from 'react';

let measuredHeight: number | null = null;
const listeners = new Set<() => void>();

export function setMeasuredMiniPlayerHeight(height: number): void {
  if (!Number.isFinite(height) || height <= 0 || measuredHeight === height) return;
  measuredHeight = height;
  listeners.forEach((listener) => listener());
}

export function getMeasuredMiniPlayerHeight(): number | null {
  return measuredHeight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMeasuredMiniPlayerHeight(fallbackHeight: number): number {
  const measured = useSyncExternalStore(subscribe, () => measuredHeight, () => null);
  return measured ?? fallbackHeight;
}
