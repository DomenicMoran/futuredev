import { decideTrackEnd, queueAfterTrackEnd } from './playbackEnd.js';
import { currentItem } from './queue.js';
import { invalidateSeekIntent } from './seekIntent.js';
import { usePlayerStore } from './store.js';
import { recordHearingSample } from './hearingProgress.js';
import { markListened, savePlaybackPosition } from './dataSource.js';

async function saveEndedPosition(lessonId: string, position: number | undefined): Promise<void> {
  if (position === undefined || !Number.isFinite(position) || position < 0) return;
  const state = usePlayerStore.getState();
  const item = state.queue.items.find((entry) => entry.lessonId === lessonId);
  if (!item) return;
  await savePlaybackPosition(lessonId, position);
  const heard = await recordHearingSample(lessonId, position, item.durationSeconds, false, state.rate);
  if (heard?.completed) await markListened(lessonId, position);
}

async function trackPlayerModule() {
  const mod = await import('react-native-track-player');
  return mod.default;
}

/** Synchronisiert Store-Index, wenn TrackPlayer zum nächsten Titel springt. */
export async function syncActiveTrackIndex(trackId: string | undefined, lastTrackId?: string, lastPosition?: number): Promise<void> {
  if (!trackId) return;
  const { runPlayerOperation } = await import('./index.js');
  await runPlayerOperation(async () => {
  const state = usePlayerStore.getState();
  const idx = state.queue.items.findIndex((item) => item.lessonId === trackId);
  if (idx < 0 || idx === state.queue.currentIndex) return;
  const timerStops = state.sleepTimer?.mode.kind === 'endOfLesson' && state.sleepTimer.target.trackId !== trackId;
  const { setSleepTimer, startPositionTracking } = await import('./index.js');
  if (timerStops) {
    await (await trackPlayerModule()).pause();
    state.setPlaying(false);
    setSleepTimer(null);
  }
  if (lastTrackId) {
    // Native moves first; use its lastPosition, never the new track's zero.
    await saveEndedPosition(lastTrackId, lastPosition).catch((error: unknown) => {
      state.setPlaybackError(error instanceof Error ? error.message : 'Hörfortschritt konnte nicht gespeichert werden.');
    });
    if (usePlayerStore.getState().queue !== state.queue) return;
    const previous = state.queue.items.find((item) => item.lessonId === lastTrackId);
    const naturalEnd = previous && lastPosition !== undefined && lastPosition >= previous.durationSeconds - 2;
    if (naturalEnd && state.repeatMode === 'one' && !timerStops) {
      const player = await trackPlayerModule();
      invalidateSeekIntent();
      await player.skip(state.queue.currentIndex);
      await player.seekTo(0);
      await player.play();
      state.setPosition(0);
      startPositionTracking(lastTrackId);
      return;
    }
    if (naturalEnd && !state.autoplayNext) {
      await (await trackPlayerModule()).pause();
      state.setPlaying(false);
    }
  }
  invalidateSeekIntent();
  state.setQueueState({ ...state.queue, currentIndex: idx });
  state.setPosition(0);
  startPositionTracking(trackId);
  });
}

/** Reagiert auf Ende der Warteschlange (Repeat, Autoplay, Stopp). */
export async function handlePlaybackQueueEnded(position?: number): Promise<void> {
  const { runPlayerOperation } = await import('./index.js');
  await runPlayerOperation(async () => {
  const state = usePlayerStore.getState();
  const timer = state.sleepTimer;
  const endedItem = currentItem(state.queue);
  if (endedItem) await saveEndedPosition(endedItem.lessonId, position).catch((error: unknown) => {
    state.setPlaybackError(error instanceof Error ? error.message : 'Hörfortschritt konnte nicht gespeichert werden.');
  });
  if (usePlayerStore.getState().queue !== state.queue) return;
  if (timer?.mode.kind === 'endOfLesson' && timer.target.trackId === endedItem?.lessonId) {
    const trackPlayer = await trackPlayerModule();
    await trackPlayer.pause();
    const { setSleepTimer, stopPositionTracking } = await import('./index.js');
    setSleepTimer(null);
    stopPositionTracking();
    usePlayerStore.getState().setPlaying(false);
    return;
  }
  const decision = decideTrackEnd(state.queue, state.repeatMode, state.autoplayNext);
  const trackPlayer = await trackPlayerModule();

  if (decision.kind === 'repeatOne') {
    await trackPlayer.seekTo(0);
    await trackPlayer.play();
    const item = currentItem(state.queue);
    if (item) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(item.lessonId);
    }
    return;
  }

  if (decision.kind === 'advance' && decision.nextIndex !== undefined) {
    const nextQueue = queueAfterTrackEnd(state.queue, decision);
    invalidateSeekIntent();
    state.setQueueState(nextQueue);
    await trackPlayer.skip(decision.nextIndex);
    await trackPlayer.play();
    const nextItem = currentItem(nextQueue);
    if (nextItem) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(nextItem.lessonId);
    }
    return;
  }

  if (decision.kind === 'wrapQueue') {
    const nextQueue = queueAfterTrackEnd(state.queue, decision);
    invalidateSeekIntent();
    state.setQueueState(nextQueue);
    await trackPlayer.skip(0);
    await trackPlayer.play();
    const nextItem = currentItem(nextQueue);
    if (nextItem) {
      const { startPositionTracking } = await import('./index.js');
      startPositionTracking(nextItem.lessonId);
    }
    return;
  }

  const { stopPositionTracking } = await import('./index.js');
  stopPositionTracking();
  state.setPlaying(false);
  });
}
