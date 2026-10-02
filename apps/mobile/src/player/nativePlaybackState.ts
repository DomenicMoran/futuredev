export type NativePlaybackPhase = 'idle' | 'playing' | 'buffering' | 'error';
export interface PlayerViewStatus { isPlaying: boolean; isBuffering: boolean; playbackError: string | null }

/** Projects RNTP state/error events into the small, truthful app-facing status. */
export function applyNativePlaybackEvent(phase: NativePlaybackPhase, error?: string, previousError: string | null = null): PlayerViewStatus {
  if (phase === 'playing') return { isPlaying: true, isBuffering: false, playbackError: null };
  if (phase === 'buffering') return { isPlaying: false, isBuffering: true, playbackError: previousError };
  if (phase === 'error') return { isPlaying: false, isBuffering: false, playbackError: error || 'Wiedergabe fehlgeschlagen.' };
  return { isPlaying: false, isBuffering: false, playbackError: previousError };
}
