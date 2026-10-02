// Playback-Service fuer react-native-track-player: reagiert auf
// Fernbedienungs-Ereignisse (Sperrbildschirm, Benachrichtigung,
// Kopfhoerertasten). Registriert ueber TrackPlayer.registerPlaybackService in
// app/_layout.tsx (Modulebene, siehe README dort), laeuft in einem eigenen
// Kontext ausserhalb der React-Baumes, deshalb hier bewusst kein Zustand aus
// store.ts: nur Aufrufe an TrackPlayer selbst und an playerActions (index.ts),
// die ihrerseits den Zustand/den Fortschritt aktualisieren.
import TrackPlayer, { Event } from 'react-native-track-player';
import { JUMP_BACKWARD_SECONDS, JUMP_FORWARD_SECONDS } from './types.js';

function dispatch(action: Promise<unknown> | Promise<void>): void {
  // Native service events can arrive while reset/teardown is gating player
  // operations; those rejections are expected and must not escape the service.
  void action.catch(() => undefined);
}

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => dispatch(import('./index.js').then(({ resumePlayback }) => resumePlayback())));
  TrackPlayer.addEventListener(Event.RemotePause, () => dispatch(import('./index.js').then(({ pausePlayback }) => pausePlayback())));
  TrackPlayer.addEventListener(Event.RemoteStop, () => dispatch(import('./index.js').then(({ pausePlayback }) => pausePlayback())));
  const ignoreQueueEdgeError = (): void => {
    // Kein Vorheriger/Nächster mehr in der Warteschlange: kein Fehlerfall.
  };
  TrackPlayer.addEventListener(Event.RemoteNext, () => dispatch(import('./index.js').then(({ skipToNext }) => skipToNext()).catch(ignoreQueueEdgeError)));
  TrackPlayer.addEventListener(Event.RemotePrevious, () => dispatch(import('./index.js').then(({ skipToPrevious }) => skipToPrevious()).catch(ignoreQueueEdgeError)));

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    dispatch(import('./index.js').then(({ seekToSeconds }) => seekToSeconds(event.position)));
  });

  // Kopfhoerertasten (doppelt/dreifach antippen) kommen als RemoteJumpForward/
  // Backward mit fester Sprungweite des Systems; die App erzwingt ihre eigenen
  // 15/30-Sekunden-Werte, statt die Systemvorgabe zu uebernehmen.
  TrackPlayer.addEventListener(Event.RemoteJumpForward, () => dispatch(import('./index.js').then(({ jumpForward }) => jumpForward(JUMP_FORWARD_SECONDS))));
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => dispatch(import('./index.js').then(({ jumpBackward }) => jumpBackward(JUMP_BACKWARD_SECONDS))));

  // Kurze Unterbrechung durch ein anderes Programm (Anruf, Navi-Ansage):
  // pausieren statt stumm weiterzuspielen, danach selbst fortsetzen lassen
  // (kein automatisches Wiederanlaufen, das waere gegen die Erwartung des
  // Nutzers bei einer laengeren Unterbrechung).
  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused) {
      dispatch(import('./index.js').then(({ pausePlayback }) => pausePlayback()));
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    dispatch(import('./trackEnd.js').then(({ handlePlaybackQueueEnded }) => handlePlaybackQueueEnded()));
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    const trackId = event.track?.id;
    if (typeof trackId === 'string') {
      dispatch(import('./trackEnd.js').then(({ syncActiveTrackIndex }) => syncActiveTrackIndex(trackId)));
    }
  });
}
