import { currentItem, goToNext, hasNext, setQueue } from './queue.js';
import type { PlaybackQueueState } from './types.js';
import type { AppRepeatMode } from './types.js';

export interface TrackEndDecision {
  readonly kind: 'repeatOne' | 'advance' | 'wrapQueue' | 'stop';
  readonly nextIndex?: number;
}

/** Reine Logik für Track-Ende (Vitest ohne TrackPlayer). */
export function decideTrackEnd(
  queue: PlaybackQueueState,
  repeatMode: AppRepeatMode,
  autoplayNext: boolean,
): TrackEndDecision {
  if (currentItem(queue) === undefined) {
    return { kind: 'stop' };
  }

  if (repeatMode === 'one') {
    return { kind: 'repeatOne' };
  }

  if (hasNext(queue)) {
    if (autoplayNext) {
      const next = goToNext(queue);
      return { kind: 'advance', nextIndex: next.currentIndex };
    }
    return { kind: 'stop' };
  }

  if (repeatMode === 'all' && queue.items.length > 0) {
    return { kind: 'wrapQueue', nextIndex: 0 };
  }

  return { kind: 'stop' };
}

export function queueAfterTrackEnd(
  queue: PlaybackQueueState,
  decision: TrackEndDecision,
): PlaybackQueueState {
  if (decision.kind === 'advance' && decision.nextIndex !== undefined) {
    return { ...queue, currentIndex: decision.nextIndex };
  }
  if (decision.kind === 'wrapQueue') {
    return setQueue([...queue.items], 0);
  }
  return queue;
}

export function nextRepeatMode(current: AppRepeatMode): AppRepeatMode {
  if (current === 'off') return 'one';
  if (current === 'one') return 'all';
  return 'off';
}
