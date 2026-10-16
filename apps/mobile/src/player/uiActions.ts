import { usePlayerStore } from './store.js';
/** UI callbacks must surface native/storage failures instead of leaking rejected promises. */
export async function runPlayerUiAction(action: () => Promise<unknown>): Promise<boolean> {
  const previousError = usePlayerStore.getState().playbackError;
  try {
    await action();
    if (usePlayerStore.getState().playbackError === previousError)
      usePlayerStore.getState().setPlaybackError(null);
    return true;
  } catch (error) {
    usePlayerStore
      .getState()
      .setPlaybackError(
        error instanceof Error
          ? error.message
          : 'Wiedergabeaktion fehlgeschlagen. Bitte erneut versuchen.',
      );
    return false;
  }
}
