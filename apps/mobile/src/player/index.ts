// Öffentliche Player-API: playLesson, enqueueModule, enqueueLessons, setRate,
// setSleepTimer, downloadLesson, deleteDownload, isDownloaded. TrackPlayer und
// expo-file-system werden per dynamischem import() nachgeladen (wie
// src/data/db.ts, src/content/fileSystemAdapter.ts): Vitest kann den
// Flow-Quelltext von react-native nicht parsen, ein Top-Level-Import würde
// also jeden Test brechen, der etwas aus src/player importiert.
import { cueSheetSchema, type CueSheet, type Lesson } from '@futuredev/content-schema';
import { getContentFs } from '../content/contentFs.js';
import { loadLocalManifest } from '../content/lessonLoader.js';
import { downloadedAudioPath, downloadedCuesPath, downloadDirPath, remoteAudioUrl, remoteCuesUrl } from './downloads.js';
import { getLessonForPlayback, markListened, savePlaybackPosition } from './dataSource.js';
import { findBlockAtPosition, findPositionForBlock } from './cues.js';
import { clampSeekPosition } from './scrubberMath.js';
import { clampRate } from './rate.js';
import { computeSleepTimerTarget, isSleepTimerElapsed, volumeForSleepTimer } from './sleepTimer.js';
import { enqueue, goToNext, goToPrevious, removeAt, reorder, setQueue } from './queue.js';
import { usePlayerStore } from './store.js';
import {
  JUMP_BACKWARD_SECONDS,
  JUMP_FORWARD_SECONDS,
  POSITION_SAVE_INTERVAL_SECONDS,
  type QueueItem,
  type SleepTimerMode,
} from './types.js';

async function TP() {
  const mod = await import('react-native-track-player');
  return mod.default;
}

/**
 * Basis-URL fuer Audio-/Cue-Dateien: Manifest zuerst (lokal abgelegt nach
 * Erststart-Kopie/Sync, gleiches Muster wie content/sync.ts:25-28).
 * `EXPO_PUBLIC_AUDIO_BASE_URL` bleibt als Override fuer lokale
 * Entwicklung/Tests erhalten, ist in der gebauten Expo-App aber leer (B-01)
 * — ohne den Manifest-Fallback blieb jede Wiedergabe stumm.
 */
export async function resolveAudioBaseUrl(fs: Awaited<ReturnType<typeof getContentFs>>): Promise<string> {
  const manifest = await loadLocalManifest(fs);
  return process.env.EXPO_PUBLIC_AUDIO_BASE_URL ?? manifest?.audioBaseUrl ?? '';
}

let setupPromise: Promise<void> | null = null;

/**
 * Einmaliger Aufbau: TrackPlayer.setupPlayer() plus die Fernbedienungs-
 * Fähigkeiten für Sperrbildschirm/Benachrichtigung (Play/Pause/Sprung/
 * Vorheriger/Nächster/Seek), dazu die Laufzeit-Berechtigung für
 * Benachrichtigungen unter Android 13+ (ohne die zeigt das System zwar die
 * Steuerung im Vordergrunddienst, aber keine sichtbare Benachrichtigung).
 */
async function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      const { PermissionsAndroid, Platform } = await import('react-native');
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {
          // Ohne Berechtigung läuft die Wiedergabe weiter, nur ohne sichtbare
          // Benachrichtigung — kein Blockierfall.
        });
      }
      const trackPlayer = await TP();
      const { Capability, AppKilledPlaybackBehavior } = await import('react-native-track-player');
      await trackPlayer.setupPlayer();
      await trackPlayer.updateOptions({
        android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        forwardJumpInterval: JUMP_FORWARD_SECONDS,
        backwardJumpInterval: JUMP_BACKWARD_SECONDS,
      });
    })();
  }
  return setupPromise;
}

// fs.exists() kapselt am Ende expo-file-system; faellt die lokale Pruefung aus
// irgendeinem Grund aus (siehe Bericht: die oberste Ebene von
// expo-file-system@57 ist die neue File/Directory-API, deren alte Funktionen
// zur Laufzeit werfen, wenn ein Aufrufer noch den alten Namen benutzt), soll
// das nie die Wiedergabe blockieren, sondern auf die Netz-URL ausweichen.
async function existsSafe(fs: Awaited<ReturnType<typeof getContentFs>>, path: string): Promise<boolean> {
  try {
    return await fs.exists(path);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------- Aufbau/Warteschlange */

async function lessonToQueueItem(lesson: Lesson): Promise<QueueItem> {
  return { lessonId: lesson.id, title: lesson.title, durationSeconds: lesson.audio.durationSeconds };
}

function cacheLessonSpeechTexts(lesson: Lesson): void {
  const store = usePlayerStore.getState();
  store.setSpeechTexts(
    lesson.id,
    lesson.speechBlocks.map((block) => block.text),
  );
  store.setSpeechBlockRoles(
    lesson.id,
    lesson.speechBlocks.map((block) => block.role),
  );
}

/** Lädt Sprechtexte und Rollen für Kapitellisten, falls noch nicht im Store. */
export async function ensureSpeechTextsForLesson(lessonId: string): Promise<void> {
  const store = usePlayerStore.getState();
  if (store.speechTextsByLessonId[lessonId] && store.speechBlockRolesByLessonId[lessonId]) return;
  const lesson = await getLessonForPlayback(lessonId);
  cacheLessonSpeechTexts(lesson);
}

async function loadCueSheet(lessonId: string): Promise<CueSheet> {
  const cached = usePlayerStore.getState().cueSheetByLessonId[lessonId];
  if (cached) return cached;

  const fs = await getContentFs();
  const localCuesPath = downloadedCuesPath(fs.documentDirectory, lessonId);
  let raw: string;
  if (await existsSafe(fs, localCuesPath)) {
    raw = await fs.readFile(localCuesPath);
  } else {
    const response = await fetch(remoteCuesUrl(await resolveAudioBaseUrl(fs), lessonId), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`loadCueSheet: Cue-Abruf für ${lessonId} fehlgeschlagen (HTTP ${response.status})`);
    }
    raw = await response.text();
  }
  // safeParse statt parse (Pruefbericht Phase 3, B-01): eine kaputte oder
  // ueber eine ungueltige Basis-URL geladene Cue-Datei darf nie als
  // unbehandelter ZodError enden, sondern wird als normaler Error gemeldet,
  // den playLesson/enqueueLessons-Aufrufer abfangen.
  const parsedCueSheet = cueSheetSchema.safeParse(JSON.parse(raw));
  if (!parsedCueSheet.success) {
    throw new Error(`loadCueSheet: Kapitelmarken fuer ${lessonId} entsprechen nicht dem Schema`);
  }
  usePlayerStore.getState().setCueSheet(lessonId, parsedCueSheet.data);
  return parsedCueSheet.data;
}

/** Lokal heruntergeladen (documentDirectory/audio/<id>.mp3) oder über die Netz-URL. */
async function audioSourceForLesson(lessonId: string): Promise<string> {
  const fs = await getContentFs();
  const localPath = downloadedAudioPath(fs.documentDirectory, lessonId);
  if (await existsSafe(fs, localPath)) return localPath;
  return remoteAudioUrl(await resolveAudioBaseUrl(fs), lessonId);
}

/**
 * Startet eine Lektion, optional ab einem Kapitelmarken-Index (Umschalter
 * Lesen/Hören, Kapitelliste). Baut die Warteschlange neu aus genau dieser
 * einen Lektion, wenn noch keine läuft — enqueueModule/enqueueLessons hängen
 * danach weitere Titel an.
 */
export async function playLesson(lessonId: string, blockIndex?: number): Promise<void> {
  const lesson = await getLessonForPlayback(lessonId);
  cacheLessonSpeechTexts(lesson);
  const cueSheet = await loadCueSheet(lessonId);
  const item = await lessonToQueueItem(lesson);

  usePlayerStore.getState().setQueueState(setQueue([item]));
  usePlayerStore.getState().setBuffering(true);

  await ensureSetup();
  const trackPlayer = await TP();
  await trackPlayer.reset();
  await trackPlayer.add({
    id: lesson.id,
    url: await audioSourceForLesson(lesson.id),
    title: lesson.title,
    artist: 'KI-generierte Stimme',
  });

  const startSeconds = blockIndex !== undefined ? findPositionForBlock(cueSheet, blockIndex) : 0;
  if (startSeconds > 0) await trackPlayer.seekTo(startSeconds);
  await trackPlayer.play();

  usePlayerStore.getState().setBuffering(false);
  usePlayerStore.getState().setPlaying(true);
  usePlayerStore.getState().setPosition(startSeconds);
}

/** Hängt alle veröffentlichten Lektionen eines Moduls an ("Modul am Stück"). */
export async function enqueueModule(moduleId: string): Promise<void> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  const ids = (manifest?.lessons ?? [])
    .map((l) => l.id)
    .filter((id) => id.startsWith(`${moduleId}-`))
    .sort();
  await enqueueLessons(ids);
}

/** Hängt konkrete Lektionskennungen an die Warteschlange an. */
export async function enqueueLessons(lessonIds: readonly string[]): Promise<void> {
  const items: QueueItem[] = [];
  for (const id of lessonIds) {
    const lesson = await getLessonForPlayback(id);
    cacheLessonSpeechTexts(lesson);
    items.push(await lessonToQueueItem(lesson));
  }
  const state = usePlayerStore.getState();
  const nextQueue = enqueue(state.queue, items);
  state.setQueueState(nextQueue);

  await ensureSetup();
  const trackPlayer = await TP();
  for (const lessonId of lessonIds) {
    await trackPlayer.add({
      id: lessonId,
      url: await audioSourceForLesson(lessonId),
      title: items.find((i) => i.lessonId === lessonId)?.title ?? lessonId,
      artist: 'KI-generierte Stimme',
    });
  }
}

export async function skipToNext(): Promise<void> {
  const state = usePlayerStore.getState();
  const nextQueue = goToNext(state.queue);
  if (nextQueue === state.queue) return;
  state.setQueueState(nextQueue);
  const trackPlayer = await TP();
  await trackPlayer.skipToNext();
}

export async function skipToPrevious(): Promise<void> {
  const state = usePlayerStore.getState();
  const previousQueue = goToPrevious(state.queue);
  if (previousQueue === state.queue) return;
  state.setQueueState(previousQueue);
  const trackPlayer = await TP();
  await trackPlayer.skipToPrevious();
}

export async function removeFromQueue(index: number): Promise<void> {
  const state = usePlayerStore.getState();
  state.setQueueState(removeAt(state.queue, index));
}

export async function reorderQueue(fromIndex: number, toIndex: number): Promise<void> {
  const state = usePlayerStore.getState();
  state.setQueueState(reorder(state.queue, fromIndex, toIndex));
}

/* --------------------------------------------------------------------- Sprung */

export async function jumpBackward(seconds: number): Promise<void> {
  const trackPlayer = await TP();
  const position = (await trackPlayer.getProgress()).position;
  await trackPlayer.seekTo(Math.max(position - seconds, 0));
}

export async function jumpForward(seconds: number): Promise<void> {
  const trackPlayer = await TP();
  const position = (await trackPlayer.getProgress()).position;
  await trackPlayer.seekTo(position + seconds);
}

export async function seekToBlock(lessonId: string, blockIndex: number): Promise<void> {
  const cueSheet = await loadCueSheet(lessonId);
  const seconds = findPositionForBlock(cueSheet, blockIndex);
  await seekToSeconds(seconds);
}

/** Seek auf absolute Position (Scrubber, Tap-to-Seek). */
export async function seekToSeconds(seconds: number): Promise<void> {
  const state = usePlayerStore.getState();
  const item = state.queue.items[state.queue.currentIndex];
  if (!item) return;
  const clamped = clampSeekPosition(seconds, item.durationSeconds);
  const trackPlayer = await TP();
  await trackPlayer.seekTo(clamped);
  usePlayerStore.getState().setPosition(clamped);
}

export function currentBlockIndex(lessonId: string, positionSeconds: number): number | null {
  const cueSheet = usePlayerStore.getState().cueSheetByLessonId[lessonId];
  if (!cueSheet) return null;
  return findBlockAtPosition(cueSheet, positionSeconds).index;
}

/* --------------------------------------------------------------------- Tempo */

export async function setRate(rate: number): Promise<void> {
  const clamped = clampRate(rate);
  const trackPlayer = await TP();
  await trackPlayer.setRate(clamped);
  usePlayerStore.getState().setRate(clamped);
}

/* --------------------------------------------------------------- Schlaf-Timer */

let sleepTimerHandle: ReturnType<typeof setInterval> | null = null;

export function setSleepTimer(mode: SleepTimerMode | null): void {
  if (sleepTimerHandle) {
    clearInterval(sleepTimerHandle);
    sleepTimerHandle = null;
  }
  if (mode === null) {
    usePlayerStore.getState().setSleepTimer(null);
    return;
  }

  const state = usePlayerStore.getState();
  const durationSeconds = state.queue.items[state.queue.currentIndex]?.durationSeconds ?? 0;
  const target = computeSleepTimerTarget(mode, Date.now(), state.positionSeconds, durationSeconds);
  usePlayerStore.getState().setSleepTimer({ mode, target });

  sleepTimerHandle = setInterval(() => {
    void (async () => {
      const current = usePlayerStore.getState().sleepTimer;
      if (!current) return;
      const now = Date.now();
      const trackPlayer = await TP();
      if (isSleepTimerElapsed(current.target, now)) {
        await trackPlayer.pause();
        await trackPlayer.setVolume(1);
        setSleepTimer(null);
        return;
      }
      await trackPlayer.setVolume(volumeForSleepTimer(current.target, now));
    })();
  }, 1000);
}

/* ------------------------------------------------------------------ Position */

let positionSaveHandle: ReturnType<typeof setInterval> | null = null;

/** Alle 5 s die Position sichern; bei Pause zusätzlich sofort (feedback_audio_gehoert_ins_layout). */
export function startPositionTracking(lessonId: string): void {
  stopPositionTracking();
  positionSaveHandle = setInterval(() => {
    void (async () => {
      const trackPlayer = await TP();
      const { position, duration } = await trackPlayer.getProgress();
      usePlayerStore.getState().setPosition(position);
      await savePlaybackPosition(lessonId, position);
      if (duration > 0 && position >= duration - 0.5) {
        await markListened(lessonId, position);
      }
    })();
  }, POSITION_SAVE_INTERVAL_SECONDS * 1000);
}

export function stopPositionTracking(): void {
  if (positionSaveHandle) {
    clearInterval(positionSaveHandle);
    positionSaveHandle = null;
  }
}

/** Sichert sofort, für den Pause-Handler (nicht erst im nächsten 5-s-Intervall). */
export async function saveCurrentPositionNow(lessonId: string): Promise<void> {
  const trackPlayer = await TP();
  const { position } = await trackPlayer.getProgress();
  usePlayerStore.getState().setPosition(position);
  await savePlaybackPosition(lessonId, position);
}

/* ------------------------------------------------------------------- Downloads */

export async function isDownloaded(lessonId: string): Promise<boolean> {
  const fs = await getContentFs();
  return existsSafe(fs, downloadedAudioPath(fs.documentDirectory, lessonId));
}

/** MP3 und Cue-Datei nach documentDirectory/audio/ laden, mit Fortschrittsanzeige im Store. */
export async function downloadLesson(lessonId: string): Promise<void> {
  const fs = await getContentFs();
  await fs.ensureDirectory(downloadDirPath(fs.documentDirectory));
  usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloading', progress: 0, bytesTotal: null });

  try {
    const base = await resolveAudioBaseUrl(fs);
    const cuesResponse = await fetch(remoteCuesUrl(base, lessonId), { cache: 'no-store' });
    if (!cuesResponse.ok) throw new Error(`Cue-Download fehlgeschlagen (HTTP ${cuesResponse.status})`);
    await fs.writeFile(downloadedCuesPath(fs.documentDirectory, lessonId), await cuesResponse.text());

    // expo-file-system@57's oberste Ebene ist die neue File/Directory-API ohne
    // downloadAsync/createDownloadResumable (die Funktionen dort werfen zur
    // Laufzeit nur einen Deprecation-Hinweis, siehe legacyWarnings.d.ts). Die
    // echte Implementierung liegt unter dem Unterpfad "/legacy".
    const { createDownloadResumable } = await import('expo-file-system/legacy');
    const audioUrl = remoteAudioUrl(base, lessonId);
    const audioPath = downloadedAudioPath(fs.documentDirectory, lessonId);

    const resumable = createDownloadResumable(audioUrl, audioPath, {}, (p) => {
      const bytesTotal = p.totalBytesExpectedToWrite;
      const progress = bytesTotal > 0 ? p.totalBytesWritten / bytesTotal : 0;
      usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloading', progress, bytesTotal });
    });
    await resumable.downloadAsync();

    usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloaded', progress: 1, bytesTotal: null });
  } catch (error) {
    usePlayerStore.getState().setDownloadState({ lessonId, status: 'error', progress: 0, bytesTotal: null });
    throw error;
  }
}

export async function deleteDownload(lessonId: string): Promise<void> {
  const fs = await getContentFs();
  const { deleteAsync } = await import('expo-file-system/legacy');
  const audioPath = downloadedAudioPath(fs.documentDirectory, lessonId);
  const cuesPath = downloadedCuesPath(fs.documentDirectory, lessonId);
  if (await existsSafe(fs, audioPath)) await deleteAsync(audioPath, { idempotent: true });
  if (await existsSafe(fs, cuesPath)) await deleteAsync(cuesPath, { idempotent: true });
  usePlayerStore
    .getState()
    .setDownloadState({ lessonId, status: 'not-downloaded', progress: 0, bytesTotal: null });
}

/** Summiert die Bytes aller lokalen Audio- und Cue-Dateien fuer die angegebenen Lektionen. */
export async function getDownloadedStorageBytes(lessonIds: readonly string[]): Promise<number | null> {
  if (lessonIds.length === 0) return null;
  const fs = await getContentFs();
  const { getInfoAsync } = await import('expo-file-system/legacy');
  let total = 0;
  let found = false;
  for (const lessonId of lessonIds) {
    for (const path of [
      downloadedAudioPath(fs.documentDirectory, lessonId),
      downloadedCuesPath(fs.documentDirectory, lessonId),
    ]) {
      if (!(await existsSafe(fs, path))) continue;
      const info = await getInfoAsync(path);
      if (info.exists && typeof info.size === 'number') {
        total += info.size;
        found = true;
      }
    }
  }
  return found ? total : null;
}

export { usePlayerStore } from './store.js';
export * from './types.js';
export { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from './types.js';
