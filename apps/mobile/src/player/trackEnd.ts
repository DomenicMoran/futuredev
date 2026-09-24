import { decideTrackEnd, queueAfterTrackEnd } from './playbackEnd.js';
import { currentItem } from './queue.js';
import { usePlayerStore } from './store.js';

async function trackPlayerModule() {
  const mod = await import('react-native-track-player');
  return mod.default;
}

/** Synchronisiert Store-Index, wenn TrackPlayer zum nächsten Titel springt. */
export async function syncActiveTrackIndex(trackId: string | undefined): Promise<void> {
  if (!trackId) return;
  const state = usePlayerStore.getState();
  const idx = state.queue.items.findIndex((item) => item.lessonId === trackId);
  if (idx < 0 || idx === state.queue.currentIndex) return;
  state.setQueueState({ ...state.queue, currentIndex: idx });
  const { startPositionTracking } = await import('./index.js');
  startPositionTracking(trackId);
}

/** Reagiert auf Ende der Warteschlange (Repeat, Autoplay, Stopp). */
export async function handlePlaybackQueueEnded(): Promise<void> {
  const state = usePlayerStore.getState();
  const decision = decideTrackEnd(state.queue, state.repeatMode, state.autoplayNext);
  const trackPlayer = await trackPlayerModule();

  if (decision.kind === 'repeatOne') {
    await trackPlayer.seekTo(0);
    await trackPlayer.play();
    state.setPlaying(true);
    const item = currentItem(state.queue);
    if (item) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(item.lessonId);
    }
    return;
  }

  if (decision.kind === 'advance' && decision.nextIndex !== undefined) {
    const nextQueue = queueAfterTrackEnd(state.queue, decision);
    state.setQueueState(nextQueue);
    const nextItem = currentItem(nextQueue);
    if (nextItem) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(nextItem.lessonId);
    }
    state.setPlaying(true);
    return;
  }

  if (decision.kind === 'wrapQueue') {
    const nextQueue = queueAfterTrackEnd(state.queue, decision);
    state.setQueueState(nextQueue);
    await trackPlayer.skip(0);
    await trackPlayer.play();
    const nextItem = currentItem(nextQueue);
    if (nextItem) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(nextItem.lessonId);
    }
    state.setPlaying(true);
    return;
  }

  const { stopPositionTracking } = await import('./index.js');
  stopPositionTracking();
  state.setPlaying(false);
}
