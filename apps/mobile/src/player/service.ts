// Playback-Service fuer react-native-track-player: reagiert auf
// Fernbedienungs-Ereignisse (Sperrbildschirm, Benachrichtigung,
// Kopfhoerertasten). Registriert ueber TrackPlayer.registerPlaybackService in
// app/_layout.tsx (Modulebene, siehe README dort), laeuft in einem eigenen
// Kontext ausserhalb der React-Baumes, deshalb hier bewusst kein Zustand aus
// store.ts: nur Aufrufe an TrackPlayer selbst und an playerActions (index.ts),
// die ihrerseits den Zustand/den Fortschritt aktualisieren.
import TrackPlayer, { Event } from 'react-native-track-player';
import { JUMP_BACKWARD_SECONDS, JUMP_FORWARD_SECONDS } from './types.js';

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  const ignoreQueueEdgeError = (): void => {
    // Kein Vorheriger/Nächster mehr in der Warteschlange: kein Fehlerfall.
  };
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext().catch(ignoreQueueEdgeError));
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious().catch(ignoreQueueEdgeError));

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    void import('./index.js').then(({ seekToSeconds }) => seekToSeconds(event.position));
  });

  // Kopfhoerertasten (doppelt/dreifach antippen) kommen als RemoteJumpForward/
  // Backward mit fester Sprungweite des Systems; die App erzwingt ihre eigenen
  // 15/30-Sekunden-Werte, statt die Systemvorgabe zu uebernehmen.
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    const position = await TrackPlayer.getProgress().then((p) => p.position);
    await TrackPlayer.seekTo(position + JUMP_FORWARD_SECONDS);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    const position = await TrackPlayer.getProgress().then((p) => p.position);
    await TrackPlayer.seekTo(Math.max(position - JUMP_BACKWARD_SECONDS, 0));
  });

  // Kurze Unterbrechung durch ein anderes Programm (Anruf, Navi-Ansage):
  // pausieren statt stumm weiterzuspielen, danach selbst fortsetzen lassen
  // (kein automatisches Wiederanlaufen, das waere gegen die Erwartung des
  // Nutzers bei einer laengeren Unterbrechung).
  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused) {
      void TrackPlayer.pause();
    }
  });
}
