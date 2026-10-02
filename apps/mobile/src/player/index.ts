// Öffentliche Player-API: playLesson, enqueueModule, enqueueLessons, setRate,
// setSleepTimer, downloadLesson, deleteDownload, isDownloaded. TrackPlayer und
// expo-file-system werden per dynamischem import() nachgeladen (wie
// src/data/db.ts, src/content/fileSystemAdapter.ts): Vitest kann den
// Flow-Quelltext von react-native nicht parsen, ein Top-Level-Import würde
// also jeden Test brechen, der etwas aus src/player importiert.
import { cueSheetSchema, type CueSheet, type Lesson } from '@futuredev/content-schema';
import { getContentFs } from '../content/contentFs.js';
import { loadContentSnapshot, type ContentSnapshot } from '../content/generation.js';
import { downloadedAudioPath, downloadedCuesPath, downloadedPackagePath, downloadDirPath, packagedDownloadPath, publishedPackagePath, remoteAudioUrl, remoteCuesUrl, stagedDownloadPath } from './downloads.js';
import { getLessonForPlayback, markListened, savePlaybackPosition } from './dataSource.js';
import { setListenProgressBaseline } from '../settings/dailyLearning.js';
import { findBlockAtPosition, findPositionForBlock } from './cues.js';
import { clampSeekPosition } from './scrubberMath.js';
import { clampRate } from './rate.js';
import { computeSleepTimerTarget, isSleepTimerElapsed, volumeForSleepTimer } from './sleepTimer.js';
import { bindQueueItemSnapshot, currentItem, snapshotForQueueItem } from './queue.js';
import { EMPTY_QUEUE, enqueue, goToNext, goToPrevious, removeAt, reorder, setQueue } from './queue.js';
import { persistRepeatMode } from './playerPreferences.js';
import { usePlayerStore } from './store.js';
import {
  JUMP_BACKWARD_SECONDS,
  JUMP_FORWARD_SECONDS,
  POSITION_SAVE_INTERVAL_SECONDS,
  POSITION_UI_UPDATE_INTERVAL_SECONDS,
  type QueueItem,
  type SleepTimerMode,
} from './types.js';
import { rampVolume as rampVolumeLinear, SOFT_START_RAMP_MS } from './rampVolume.js';
import { applyNativePlaybackEvent } from './nativePlaybackState.js';
import { clearListenProgressBaselines } from '../settings/dailyLearning.js';
import { checksumCueText, isPlausibleMp3Prefix, parseDownloadPackageMarker, validateCueText } from './downloadValidation.js';
import { fetchTextWithTimeout } from './mediaFetch.js';
import { lessonIdsFromLessonInModule, lessonIdsInModule } from './moduleLessonIds.js';
import { beginSeekIntent, invalidateSeekIntent, isCurrentSeekIntent } from './seekIntent.js';

export { rampVolume, SOFT_START_RAMP_MS } from './rampVolume.js';

const cueSheetCache = new Map<string, CueSheet>();

/** Clears warmed cue entries (playback reset and tests). */
export function clearCueSheetCache(): void {
  cueSheetCache.clear();
}

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
export async function resolveAudioBaseUrl(
  fs: Awaited<ReturnType<typeof getContentFs>>,
  pinnedSnapshot?: ContentSnapshot,
): Promise<string> {
  const snapshot = pinnedSnapshot ?? await loadContentSnapshot(fs);
  return process.env.EXPO_PUBLIC_AUDIO_BASE_URL ?? snapshot.manifest?.audioBaseUrl ?? '';
}

let setupPromise: Promise<void> | null = null;
let nativeSetupComplete = false;
let optionsSetupComplete = false;
let listenersAttached = false;
const attachedPlaybackListeners = new Set<string>();
let playIntentEpoch = 0;
let startIntentEpoch = 0;
let playerLifecycleEpoch = 0;
let playerResetting = false;
const lifecycleBarriers = new Set<symbol>();
let lifecycleTransitionTail: Promise<void> = Promise.resolve();
let closeTransition: Promise<void> | null = null;
interface PlayerResetLeaseCore { readonly ready: Promise<void>; readonly barrier: symbol; readonly owners: Set<symbol>; settled: boolean }
let activePlayerResetLease: PlayerResetLeaseCore | null = null;
const playerOperations = new Set<Promise<void>>();

export interface PlayerResetLease {
  /** Native player/download reset preparation; caller retains gate through its DB/cache work. */
  readonly ready: Promise<void>;
  /** Releases only this reset's gate, idempotently. */
  release(): void;
}

function claimLifecycleBarrier(): symbol {
  const token = Symbol('player-lifecycle-barrier');
  lifecycleBarriers.add(token);
  playerResetting = true;
  return token;
}

function releaseLifecycleBarrier(token: symbol): void {
  lifecycleBarriers.delete(token);
  playerResetting = lifecycleBarriers.size > 0;
}

function invalidatePlayerLifecycle(): void {
  startIntentEpoch += 1;
  playerLifecycleEpoch += 1;
  playIntentEpoch += 1;
}

function serializeLifecycleTransition<T>(work: () => Promise<T>): Promise<T> {
  const previous = lifecycleTransitionTail;
  let release!: () => void;
  lifecycleTransitionTail = new Promise<void>((resolve) => { release = resolve; });
  return previous.then(work).finally(release);
}
let queueReplacementTail: Promise<void> = Promise.resolve();

function assertStartIntent(lifecycleEpoch: number, intent: number): void {
  assertPlayerEpoch(lifecycleEpoch);
  if (intent !== startIntentEpoch) throw new Error('Wiedergabeauswahl wurde ersetzt');
}

async function withLatestQueueReplacement<T>(intent: number, work: () => Promise<T>): Promise<T> {
  const previous = queueReplacementTail;
  let release!: () => void;
  queueReplacementTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    if (intent !== startIntentEpoch) throw new Error('Wiedergabeauswahl wurde ersetzt');
    return await work();
  } finally { release(); }
}

function assertPlayerEpoch(epoch: number): void {
  if (playerResetting || epoch !== playerLifecycleEpoch) throw new Error('Player-Reset läuft gerade');
}

export function runPlayerOperation<T>(work: (epoch: number) => Promise<T>): Promise<T> {
  if (playerResetting) return Promise.reject(new Error('Player-Reset läuft gerade'));
  const epoch = playerLifecycleEpoch;
  const operation = work(epoch);
  const drain = operation.then(() => undefined, () => undefined);
  playerOperations.add(drain);
  void drain.finally(() => playerOperations.delete(drain));
  return operation;
}

async function rampTrackPlayerVolume(trackPlayer: Awaited<ReturnType<typeof TP>>, from: number, to: number, durationMs: number, token: number): Promise<void> {
  await rampVolumeLinear((v) => trackPlayer.setVolume(v), from, to, durationMs, undefined, () => token === playIntentEpoch);
}

/** Schlaf-Timer-Duck aufheben, Lautstärke normalisieren, Tempo erneut setzen. */
async function preparePlaybackStart(trackPlayer: Awaited<ReturnType<typeof TP>>): Promise<void> {
  await trackPlayer.setVolume(1);
  const rate = usePlayerStore.getState().rate;
  await trackPlayer.setRate(rate);
}

async function softStartPlay(trackPlayer: Awaited<ReturnType<typeof TP>>, token: number): Promise<void> {
  await trackPlayer.setVolume(0);
  if (token !== playIntentEpoch) return;
  await trackPlayer.play();
  await rampTrackPlayerVolume(trackPlayer, 0, 1, SOFT_START_RAMP_MS, token);
}

/**
 * Einmaliger Aufbau: TrackPlayer.setupPlayer() plus die Fernbedienungs-
 * Fähigkeiten für Sperrbildschirm/Benachrichtigung (Play/Pause/Sprung/
 * Vorheriger/Nächster/Seek), dazu die Laufzeit-Berechtigung für
 * Benachrichtigungen unter Android 13+ (ohne die zeigt das System zwar die
 * Steuerung im Vordergrunddienst, aber keine sichtbare Benachrichtigung).
 */
async function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    const attempt = (async () => {
      const { PermissionsAndroid, Platform } = await import('react-native');
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {
          // Ohne Berechtigung läuft die Wiedergabe weiter, nur ohne sichtbare
          // Benachrichtigung — kein Blockierfall.
        });
      }
      const trackPlayer = await TP();
      const {
        AndroidAudioContentType,
        AppKilledPlaybackBehavior,
        Capability,
        IOSCategory,
        IOSCategoryMode,
      } = await import('react-native-track-player');
      if (!nativeSetupComplete) await trackPlayer.setupPlayer({
        androidAudioContentType: AndroidAudioContentType.Speech,
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.SpokenAudio,
        autoHandleInterruptions: true,
      });
      nativeSetupComplete = true;
      if (!optionsSetupComplete) await trackPlayer.updateOptions({
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
        progressUpdateEventInterval: POSITION_UI_UPDATE_INTERVAL_SECONDS,
      });
      optionsSetupComplete = true;
      if (listenersAttached) return;
      const { Event, State } = await import('react-native-track-player');
      if (!attachedPlaybackListeners.has('state')) trackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
        if (playerResetting) {
          if (state === State.Playing) void trackPlayer.pause();
          return;
        }
        const store = usePlayerStore.getState();
        const phase = state === State.Playing ? 'playing' : state === State.Buffering || state === State.Loading ? 'buffering' : state === State.Error ? 'error' : 'idle';
        if (phase === 'idle' || phase === 'error') playIntentEpoch += 1;
        const status = applyNativePlaybackEvent(phase, phase === 'error' ? store.playbackError ?? 'Wiedergabe fehlgeschlagen.' : undefined, store.playbackError);
        store.setPlaying(status.isPlaying);
        store.setBuffering(status.isBuffering);
        store.setPlaybackError(status.playbackError);
      });
      attachedPlaybackListeners.add('state');
      if (!attachedPlaybackListeners.has('error')) trackPlayer.addEventListener(Event.PlaybackError, ({ message, code }) => {
        if (playerResetting) return;
        playIntentEpoch += 1;
        const store = usePlayerStore.getState();
        const status = applyNativePlaybackEvent('error', message || code);
        store.setPlaying(false);
        store.setBuffering(false);
        store.setPlaybackError(status.playbackError);
      });
      attachedPlaybackListeners.add('error');
      if (!attachedPlaybackListeners.has('active')) trackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
        if (playerResetting) return;
        const timer = usePlayerStore.getState().sleepTimer;
        if (timer?.mode.kind === 'endOfLesson' && track?.id && track.id !== timer.target.trackId) {
          setSleepTimer(null);
          void trackPlayer.pause();
        }
      });
      attachedPlaybackListeners.add('active');
      listenersAttached = true;
    })();
    setupPromise = attempt;
    void attempt.catch(() => { if (setupPromise === attempt) setupPromise = null; });
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

async function loadCueSheet(lessonId: string, pinnedSnapshot?: ContentSnapshot): Promise<CueSheet> {
  const fs = await getContentFs();
  const snapshot = pinnedSnapshot ?? await loadContentSnapshot(fs);
  const cacheKey = `${snapshot.generationId ?? snapshot.root}\u0000${lessonId}`;
  const cached = cueSheetCache.get(cacheKey);
  if (cached) {
    usePlayerStore.getState().setCueSheet(lessonId, cached);
    return cached;
  }
  let raw: string;
  const lesson = await getLessonForPlayback(lessonId, snapshot);
  const localDownload = await validLocalDownload(fs, lesson);
  if (localDownload) {
    raw = localDownload.cueText;
  } else {
    const response = await fetchTextWithTimeout(remoteCuesUrl(await resolveAudioBaseUrl(fs, snapshot), lessonId));
    if (!response.ok) {
      throw new Error(`loadCueSheet: Cue-Abruf für ${lessonId} fehlgeschlagen (HTTP ${response.status})`);
    }
    raw = response.text;
  }
  // safeParse statt parse (Pruefbericht Phase 3, B-01): eine kaputte oder
  // ueber eine ungueltige Basis-URL geladene Cue-Datei darf nie als
  // unbehandelter ZodError enden, sondern wird als normaler Error gemeldet,
  // den playLesson/enqueueLessons-Aufrufer abfangen.
  const parsedCueSheet = cueSheetSchema.safeParse(JSON.parse(raw));
  if (!parsedCueSheet.success) {
    throw new Error(`loadCueSheet: Kapitelmarken fuer ${lessonId} entsprechen nicht dem Schema`);
  }
  cueSheetCache.set(cacheKey, parsedCueSheet.data);
  if (cueSheetCache.size > 64) {
    const oldest = cueSheetCache.keys().next();
    if (!oldest.done) cueSheetCache.delete(oldest.value);
  }
  usePlayerStore.getState().setCueSheet(lessonId, parsedCueSheet.data);
  return parsedCueSheet.data;
}

interface ValidLocalDownload { readonly audioPath: string; readonly cuesPath: string; readonly cueText: string }

async function validLocalDownloadCandidate(fs: Awaited<ReturnType<typeof getContentFs>>, lesson: Lesson, markerPath: string): Promise<ValidLocalDownload | null> {
  try {
    const marker = parseDownloadPackageMarker(await fs.readFile(markerPath), lesson.id);
    if (!marker) return null;
    const audioPath = `${downloadDirPath(fs.documentDirectory)}${marker.audioFile}`;
    const cuesPath = `${downloadDirPath(fs.documentDirectory)}${marker.cuesFile}`;
    if (await fs.getFileSize(audioPath) !== marker.audioBytes || await fs.getFileSize(cuesPath) !== marker.cuesBytes) return null;
    const prefix = await fs.readFilePrefixBase64(audioPath, 64);
    if (prefix !== marker.audioPrefix || !isPlausibleMp3Prefix(prefix)) return null;
    const cueText = await fs.readFile(cuesPath);
    if (checksumCueText(cueText) !== marker.cuesChecksum) return null;
    validateCueText(cueText, lesson);
    return { audioPath, cuesPath, cueText };
  } catch { return null; }
}

async function validLocalDownload(fs: Awaited<ReturnType<typeof getContentFs>>, lesson: Lesson): Promise<ValidLocalDownload | null> {
  let markerPaths: string[];
  try {
    markerPaths = (await fs.listDirectory(downloadDirPath(fs.documentDirectory)))
      .filter((name) => name.startsWith(`${lesson.id}.`) && name.endsWith('.download.json'))
      .map((name) => `${downloadDirPath(fs.documentDirectory)}${name}`);
    if (await existsSafe(fs, downloadedPackagePath(fs.documentDirectory, lesson.id))) markerPaths.push(downloadedPackagePath(fs.documentDirectory, lesson.id));
  } catch { markerPaths = []; }
  const candidates = markerPaths.sort().reverse();
  for (const markerPath of candidates) {
    const candidate = await validLocalDownloadCandidate(fs, lesson, markerPath);
    if (candidate) return candidate;
  }

  // Explicit legacy path: accept old flat files only if BOTH have coherent sizes,
  // an MP3 frame/ID3 prefix, and a cue sheet that matches the local lesson.
  const audioPath = downloadedAudioPath(fs.documentDirectory, lesson.id);
  const cuesPath = downloadedCuesPath(fs.documentDirectory, lesson.id);
  if (!(await existsSafe(fs, audioPath)) || !(await existsSafe(fs, cuesPath))) return null;
  try {
    const audioBytes = await fs.getFileSize(audioPath);
    const cuesBytes = await fs.getFileSize(cuesPath);
    if (audioBytes === null || audioBytes < 1024 || cuesBytes === null || cuesBytes < 2) return null;
    if (!isPlausibleMp3Prefix(await fs.readFilePrefixBase64(audioPath, 64))) return null;
    const cueText = await fs.readFile(cuesPath);
    validateCueText(cueText, lesson);
    return { audioPath, cuesPath, cueText };
  } catch { return null; }
}

/** Lokal heruntergeladen (documentDirectory/audio/<id>.mp3) oder über die Netz-URL. */
async function audioSourceForLesson(lessonId: string, snapshot?: ContentSnapshot): Promise<string> {
  try {
    const localPath = await getValidatedLocalAudioPath(lessonId, snapshot);
    if (localPath) return localPath;
  } catch { /* corrupted/offline file -> fetch from source */ }
  const fs = await getContentFs();
  return remoteAudioUrl(await resolveAudioBaseUrl(fs, snapshot), lessonId);
}

/** Returns a fully validated local generation, or null; shared by playback/fallback regression tests. */
export async function getValidatedLocalAudioPath(lessonId: string, pinnedSnapshot?: ContentSnapshot): Promise<string | null> {
  const fs = await getContentFs();
  const snapshot = pinnedSnapshot ?? await loadContentSnapshot(fs);
  const lesson = await getLessonForPlayback(lessonId, snapshot);
  return (await validLocalDownload(fs, lesson))?.audioPath ?? null;
}

async function startQueue(
  items: readonly QueueItem[],
  startIndex: number,
  blockIndex?: number,
  lifecycleEpoch = playerLifecycleEpoch,
  intent = startIntentEpoch,
  snapshot?: ContentSnapshot,
): Promise<void> {
  if (items.length === 0) return;
  const startItem = items[startIndex];
  if (!startItem) return;
  let playToken = 0;
  if (snapshot) for (const item of items) bindQueueItemSnapshot(item, snapshot);

  try {
  await withLatestQueueReplacement(intent, async () => {
  assertStartIntent(lifecycleEpoch, intent);
  usePlayerStore.getState().setQueueState(setQueue(items, startIndex));
  usePlayerStore.getState().setPlaying(false);
  usePlayerStore.getState().setPosition(0);
  usePlayerStore.getState().setPlaybackError(null);
  usePlayerStore.getState().setBuffering(true);
  await ensureSetup();
  assertStartIntent(lifecycleEpoch, intent);
  const trackPlayer = await TP();
  assertStartIntent(lifecycleEpoch, intent);
  await trackPlayer.reset();
  assertStartIntent(lifecycleEpoch, intent);
  for (const queueItem of items) {
    assertStartIntent(lifecycleEpoch, intent);
    const url = await audioSourceForLesson(queueItem.lessonId, snapshot);
    assertStartIntent(lifecycleEpoch, intent);
    await trackPlayer.add({
      id: queueItem.lessonId,
      url,
      title: queueItem.title,
      artist: 'KI-generierte Stimme',
    });
    assertStartIntent(lifecycleEpoch, intent);
  }

  let startSeconds = 0;
  if (blockIndex !== undefined) {
    const cueSheet = await loadCueSheet(startItem.lessonId, snapshot);
    assertStartIntent(lifecycleEpoch, intent);
    startSeconds = findPositionForBlock(cueSheet, blockIndex);
  }
  if (startIndex > 0) {
    await trackPlayer.skip(startIndex);
    assertStartIntent(lifecycleEpoch, intent);
  }
  if (startSeconds > 0) { await trackPlayer.seekTo(startSeconds); assertStartIntent(lifecycleEpoch, intent); }
  await preparePlaybackStart(trackPlayer);
  assertStartIntent(lifecycleEpoch, intent);
  playToken = ++playIntentEpoch;
  await softStartPlay(trackPlayer, playToken);
  if (playToken !== playIntentEpoch) return;
  usePlayerStore.getState().setPosition(startSeconds);
  startPositionTracking(startItem.lessonId);
  });
  } catch (error) {
    if (playToken === playIntentEpoch && intent === startIntentEpoch && lifecycleEpoch === playerLifecycleEpoch && !playerResetting) {
      usePlayerStore.getState().setBuffering(false);
      usePlayerStore.getState().setPlaying(false);
    }
    usePlayerStore.getState().setPlaybackError(error instanceof Error ? error.message : 'Wiedergabe fehlgeschlagen.');
    throw error;
  }
}

/**
 * Startet eine Lektion, optional ab einem Kapitelmarken-Index (Umschalter
 * Lesen/Hören, Kapitelliste). Baut die Warteschlange neu aus genau dieser
 * einen Lektion — enqueueModule/enqueueLessons hängen danach weitere Titel an.
 */
/** Gleiche Lektion in der Warteschlange: Fortsetzen statt Reset (kein Lautstärke-Blast). */
/** Idempotenter Resume-Endpunkt für UI und Remote-Control (nie ein Toggle). */
export function resumePlayback(): Promise<void> {
  return runPlayerOperation(async (epoch) => {
    await ensureSetup(); assertPlayerEpoch(epoch);
    const player = await TP(); assertPlayerEpoch(epoch);
    await player.setVolume(1); assertPlayerEpoch(epoch);
    await player.setRate(usePlayerStore.getState().rate); assertPlayerEpoch(epoch);
    usePlayerStore.getState().setPlaybackError(null);
    await player.play(); assertPlayerEpoch(epoch);
  });
}

export function pausePlayback(): Promise<void> {
  return runPlayerOperation(async (epoch) => {
    await ensureSetup(); assertPlayerEpoch(epoch);
    const player = await TP(); assertPlayerEpoch(epoch);
    await player.pause(); assertPlayerEpoch(epoch);
    usePlayerStore.getState().setPlaying(false);
    const item = currentItem(usePlayerStore.getState().queue);
    if (item) await saveCurrentPositionNow(item.lessonId);
  });
}

export function togglePlayback(): Promise<void> {
  return runPlayerOperation(async (epoch) => {
  try {
    await ensureSetup();
    assertPlayerEpoch(epoch);
    const trackPlayer = await TP();
    assertPlayerEpoch(epoch);
    const { State } = await import('react-native-track-player');
    const nativeState = await trackPlayer.getPlaybackState();
    if (nativeState.state === State.Playing) {
      await trackPlayer.pause();
      assertPlayerEpoch(epoch);
      usePlayerStore.getState().setPlaying(false);
      const item = currentItem(usePlayerStore.getState().queue);
      if (item) await saveCurrentPositionNow(item.lessonId);
      return;
    }
    usePlayerStore.getState().setPlaybackError(null);
    await preparePlaybackStart(trackPlayer);
    assertPlayerEpoch(epoch);
    const playToken = ++playIntentEpoch;
    await softStartPlay(trackPlayer, playToken);
  } catch (error) {
    if (epoch === playerLifecycleEpoch && !playerResetting) {
      const store = usePlayerStore.getState();
      store.setPlaying(false);
      store.setBuffering(false);
      store.setPlaybackError(error instanceof Error ? error.message : 'Wiedergabe fehlgeschlagen.');
    }
    throw error;
  }
  });
}

export function isSameLessonInQueue(lessonId: string): boolean {
  return currentItem(usePlayerStore.getState().queue)?.lessonId === lessonId;
}

export function playLesson(lessonId: string, blockIndex?: number): Promise<void> {
  invalidateSeekIntent();
  const intent = ++startIntentEpoch;
  return runPlayerOperation(async (epoch) => {
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  const lesson = await getLessonForPlayback(lessonId, snapshot);
  assertStartIntent(epoch, intent);
  cacheLessonSpeechTexts(lesson);
  const item = await lessonToQueueItem(lesson);
  assertStartIntent(epoch, intent);
  await startQueue([item], 0, blockIndex, epoch, intent, snapshot);
  });
}

/** Startet ab dieser Lektion und stellt den Rest des Moduls in die Warteschlange. */
export function playLessonInModuleContext(lessonId: string, blockIndex?: number): Promise<void> {
  invalidateSeekIntent();
  const intent = ++startIntentEpoch;
  return runPlayerOperation(async (epoch) => {
  const fs = await getContentFs();
  assertStartIntent(epoch, intent);
  const snapshot = await loadContentSnapshot(fs);
  assertStartIntent(epoch, intent);
  const lessonIds = await lessonIdsFromLessonInModule(lessonId, snapshot);
  const items: QueueItem[] = [];
  for (const id of lessonIds) {
    assertStartIntent(epoch, intent);
    const lesson = await getLessonForPlayback(id, snapshot);
    assertStartIntent(epoch, intent);
    cacheLessonSpeechTexts(lesson);
    items.push(await lessonToQueueItem(lesson));
  }
  if (items.length === 0) {
    const lesson = await getLessonForPlayback(lessonId, snapshot);
    assertStartIntent(epoch, intent);
    cacheLessonSpeechTexts(lesson);
    const item = await lessonToQueueItem(lesson);
    assertStartIntent(epoch, intent);
    await startQueue([item], 0, blockIndex, epoch, intent, snapshot);
    return;
  }
  await startQueue(items, 0, blockIndex, epoch, intent, snapshot);
  });
}

/** Stoppt Wiedergabe, leert Warteschlange und Benachrichtigung. */
export async function clearPlayback(): Promise<void> {
  if (closeTransition) return closeTransition;
  if (playerResetting) return;
  invalidateSeekIntent();
  const barrier = claimLifecycleBarrier();
  invalidatePlayerLifecycle();
  closeTransition = serializeLifecycleTransition(async () => {
   try {
    await Promise.allSettled([...playerOperations]);
    await Promise.allSettled([...positionSaveTasks]);
    clearCueSheetCache();
    stopPositionTracking();
    setSleepTimer(null);
    usePlayerStore.getState().setQueueState(EMPTY_QUEUE);
    usePlayerStore.getState().setPlaying(false);
    usePlayerStore.getState().setBuffering(false);
    usePlayerStore.getState().setPosition(0);
    usePlayerStore.getState().setPlaybackError(null);
    await ensureSetup();
    const trackPlayer = await TP();
    await trackPlayer.reset();
   } catch {
    // Kein Blockierfall, wenn TrackPlayer noch nicht initialisiert ist.
   }
  }).finally(() => {
    releaseLifecycleBarrier(barrier);
    closeTransition = null;
  });
  return closeTransition;
}

export function applyRepeatMode(mode: import('./types.js').AppRepeatMode): Promise<void> {
  return runPlayerOperation(async (epoch) => {
    usePlayerStore.getState().setRepeatMode(mode);
    await persistRepeatMode(mode);
    assertPlayerEpoch(epoch);
  });
}

/** Hängt alle veröffentlichten Lektionen eines Moduls an ("Modul am Stück"). */
export function enqueueModule(moduleId: string): Promise<void> {
  return runPlayerOperation(async (epoch) => {
  const fs = await getContentFs();
  assertPlayerEpoch(epoch);
  const snapshot = await loadContentSnapshot(fs);
  assertPlayerEpoch(epoch);
  const ids = await lessonIdsInModule(moduleId, snapshot);
  await enqueueLessons(ids, snapshot);
  assertPlayerEpoch(epoch);
  });
}

/** Startet die Wiedergabe einer gespeicherten Playlist in Reihenfolge der Einträge. */
export function playPlaylist(playlistId: string): Promise<void> {
  invalidateSeekIntent();
  const intent = ++startIntentEpoch;
  return runPlayerOperation(async (epoch) => {
  const { listPlaylistItems } = await import('../data/playlists.js');
  assertStartIntent(epoch, intent);
  const items = await listPlaylistItems(playlistId);
  assertStartIntent(epoch, intent);
  if (items.length === 0) {
    throw new Error('playlist_empty');
  }
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  const queueItems: QueueItem[] = [];
  for (const item of items) {
    assertStartIntent(epoch, intent);
    const lesson = await getLessonForPlayback(item.lessonId, snapshot);
    assertStartIntent(epoch, intent);
    cacheLessonSpeechTexts(lesson);
    queueItems.push(await lessonToQueueItem(lesson));
    assertStartIntent(epoch, intent);
  }
  await startQueue(queueItems, 0, undefined, epoch, intent, snapshot);
  });
}

/** Hängt konkrete Lektionskennungen an die Warteschlange an. */
export function enqueueLessons(lessonIds: readonly string[], pinnedSnapshot?: ContentSnapshot): Promise<void> {
  return runPlayerOperation(async (epoch) => {
  const fs = await getContentFs();
  const snapshot = pinnedSnapshot ?? await loadContentSnapshot(fs);
  const items: QueueItem[] = [];
  for (const id of lessonIds) {
    assertPlayerEpoch(epoch);
    const lesson = await getLessonForPlayback(id, snapshot);
    assertPlayerEpoch(epoch);
    cacheLessonSpeechTexts(lesson);
    const item = await lessonToQueueItem(lesson);
    bindQueueItemSnapshot(item, snapshot);
    items.push(item);
  }
  const state = usePlayerStore.getState();
  const nextQueue = enqueue(state.queue, items);
  state.setQueueState(nextQueue);

  await ensureSetup();
  assertPlayerEpoch(epoch);
  const trackPlayer = await TP();
  assertPlayerEpoch(epoch);
  for (const lessonId of lessonIds) {
    assertPlayerEpoch(epoch);
    await trackPlayer.add({
      id: lessonId,
      url: await audioSourceForLesson(lessonId, snapshot),
      title: items.find((i) => i.lessonId === lessonId)?.title ?? lessonId,
      artist: 'KI-generierte Stimme',
    });
  }
  });
}

export function skipToNext(): Promise<void> {
  invalidateSeekIntent();
  return runPlayerOperation(async (epoch) => {
  const state = usePlayerStore.getState();
  const nextQueue = goToNext(state.queue);
  if (nextQueue === state.queue) return;
  state.setQueueState(nextQueue);
  const trackPlayer = await TP();
  assertPlayerEpoch(epoch);
  await trackPlayer.skipToNext();
  assertPlayerEpoch(epoch);
  const nextItem = nextQueue.items[nextQueue.currentIndex];
  if (nextItem) startPositionTracking(nextItem.lessonId);
  });
}

export function skipToPrevious(): Promise<void> {
  invalidateSeekIntent();
  return runPlayerOperation(async (epoch) => {
  const state = usePlayerStore.getState();
  const previousQueue = goToPrevious(state.queue);
  if (previousQueue === state.queue) return;
  state.setQueueState(previousQueue);
  const trackPlayer = await TP();
  assertPlayerEpoch(epoch);
  await trackPlayer.skipToPrevious();
  assertPlayerEpoch(epoch);
  const prevItem = previousQueue.items[previousQueue.currentIndex];
  if (prevItem) startPositionTracking(prevItem.lessonId);
  });
}

export async function removeFromQueue(index: number): Promise<void> {
  if (playerResetting) return;
  const state = usePlayerStore.getState();
  const nextQueue = removeAt(state.queue, index);
  if (currentItem(nextQueue) !== currentItem(state.queue)) invalidateSeekIntent();
  state.setQueueState(nextQueue);
}

export async function reorderQueue(fromIndex: number, toIndex: number): Promise<void> {
  if (playerResetting) return;
  const state = usePlayerStore.getState();
  state.setQueueState(reorder(state.queue, fromIndex, toIndex));
}

/* --------------------------------------------------------------------- Sprung */

export function jumpBackward(seconds: number): Promise<void> {
  const seekIntent = beginSeekIntent();
  return runPlayerOperation(async (epoch) => {
    const targetItem = currentItem(usePlayerStore.getState().queue);
    if (!targetItem) return;
    const trackPlayer = await TP(); assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    const position = (await trackPlayer.getProgress()).position; assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    await trackPlayer.seekTo(Math.max(position - seconds, 0));
  });
}

export function jumpForward(seconds: number): Promise<void> {
  const seekIntent = beginSeekIntent();
  return runPlayerOperation(async (epoch) => {
    const targetItem = currentItem(usePlayerStore.getState().queue);
    if (!targetItem) return;
    const trackPlayer = await TP(); assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    const position = (await trackPlayer.getProgress()).position; assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    await trackPlayer.seekTo(position + seconds);
  });
}

export function seekToBlock(lessonId: string, blockIndex: number): Promise<void> {
  const seekIntent = beginSeekIntent();
  return runPlayerOperation(async (epoch) => {
    const targetItem = currentItem(usePlayerStore.getState().queue);
    if (!targetItem || targetItem.lessonId !== lessonId) return;
    const cueSheet = await loadCueSheet(lessonId, snapshotForQueueItem(targetItem));
    assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    const seconds = clampSeekPosition(findPositionForBlock(cueSheet, blockIndex), targetItem.durationSeconds);
    const trackPlayer = await TP();
    assertPlayerEpoch(epoch);
    if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== targetItem) return;
    await trackPlayer.seekTo(seconds);
    assertPlayerEpoch(epoch);
    if (isCurrentSeekIntent(seekIntent) && currentItem(usePlayerStore.getState().queue) === targetItem) {
      usePlayerStore.getState().setPosition(seconds);
    }
  });
}

/** Seek auf absolute Position (Scrubber, Tap-to-Seek). */
export function seekToSeconds(seconds: number): Promise<void> {
  const seekIntent = beginSeekIntent();
  return runPlayerOperation(async (epoch) => {
  const state = usePlayerStore.getState();
  const item = state.queue.items[state.queue.currentIndex];
  if (!item) return;
  const clamped = clampSeekPosition(seconds, item.durationSeconds);
  const trackPlayer = await TP();
  assertPlayerEpoch(epoch);
  if (!isCurrentSeekIntent(seekIntent) || currentItem(usePlayerStore.getState().queue) !== item) return;
  await trackPlayer.seekTo(clamped);
  assertPlayerEpoch(epoch);
  if (isCurrentSeekIntent(seekIntent) && currentItem(usePlayerStore.getState().queue) === item) {
    usePlayerStore.getState().setPosition(clamped);
  }
  });
}

export function currentBlockIndex(lessonId: string, positionSeconds: number): number | null {
  const cueSheet = usePlayerStore.getState().cueSheetByLessonId[lessonId];
  if (!cueSheet) return null;
  return findBlockAtPosition(cueSheet, positionSeconds).index;
}

/* --------------------------------------------------------------------- Tempo */

export function setRate(rate: number): Promise<void> {
  return runPlayerOperation(async (epoch) => {
  const clamped = clampRate(rate);
  const trackPlayer = await TP();
  assertPlayerEpoch(epoch);
  await trackPlayer.setRate(clamped);
  assertPlayerEpoch(epoch);
  usePlayerStore.getState().setRate(clamped);
  });
}

/* --------------------------------------------------------------- Schlaf-Timer */

let sleepTimerHandle: ReturnType<typeof setInterval> | null = null;
let sleepTimerEpoch = 0;

export function setSleepTimer(mode: SleepTimerMode | null): void {
  if (playerResetting && mode !== null) return;
  sleepTimerEpoch += 1;
  const token = sleepTimerEpoch;
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
  const trackId = state.queue.items[state.queue.currentIndex]?.lessonId;
  const target = computeSleepTimerTarget(mode, Date.now(), state.positionSeconds, durationSeconds, state.rate);
  const timerTarget = mode.kind === 'endOfLesson' && trackId ? { ...target, trackId } : target;
  usePlayerStore.getState().setSleepTimer({ mode, target: timerTarget });

  sleepTimerHandle = setInterval(() => {
    void (async () => {
      const current = usePlayerStore.getState().sleepTimer;
      if (!current) return;
      const now = Date.now();
      const trackPlayer = await TP();
      if (token !== sleepTimerEpoch) return;
      if (current.mode.kind === 'endOfLesson') {
        const progress = await trackPlayer.getProgress();
        if (token !== sleepTimerEpoch) return;
        if (current.target.trackId && currentItem(usePlayerStore.getState().queue)?.lessonId !== current.target.trackId) {
          await trackPlayer.pause();
          setSleepTimer(null);
          return;
        }
        if (!usePlayerStore.getState().isPlaying) {
          await trackPlayer.setVolume(1);
          return;
        }
        if (progress.duration > 0 && progress.position >= progress.duration - 0.35) {
          await trackPlayer.pause();
          if (token === sleepTimerEpoch) setSleepTimer(null);
          return;
        }
        const rate = usePlayerStore.getState().rate;
        const remaining = Math.max(0, progress.duration - progress.position) / rate;
        const dynamicTarget = { ...current.target, endsAtMs: now + remaining * 1000 };
        usePlayerStore.getState().setSleepTimer({ ...current, target: dynamicTarget });
        await trackPlayer.setVolume(volumeForSleepTimer(dynamicTarget, now));
        return;
      }
      if (isSleepTimerElapsed(current.target, now)) {
        await trackPlayer.pause();
        if (token !== sleepTimerEpoch) return;
        await trackPlayer.setVolume(1);
        setSleepTimer(null);
        return;
      }
      await trackPlayer.setVolume(volumeForSleepTimer(current.target, now));
    })().catch((error) => {
      if (token === sleepTimerEpoch) usePlayerStore.getState().setPlaybackError(error instanceof Error ? error.message : 'Timerfehler');
    });
  }, 1000);
}

/* ------------------------------------------------------------------ Position */

let positionSaveHandle: ReturnType<typeof setInterval> | null = null;
let positionUiPollHandle: ReturnType<typeof setInterval> | null = null;
let progressListenerAttached = false;
let trackedLessonId: string | null = null;
let positionEpoch = 0;
const positionSaveTasks = new Set<Promise<void>>();

function attachPlaybackProgressListener(): void {
  if (progressListenerAttached) return;
  progressListenerAttached = true;
  void (async () => {
    const trackPlayer = await TP();
    const { Event } = await import('react-native-track-player');
    trackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position }) => {
      if (playerResetting) return;
      usePlayerStore.getState().setPosition(position);
    });
  })();
}

/** Live-UI per TrackPlayer-Event; SQLite nur alle 5 s (feedback_audio_gehoert_ins_layout). */
export function startPositionTracking(lessonId: string): void {
  if (playerResetting) return;
  stopPositionTracking();
  const token = positionEpoch;
  trackedLessonId = lessonId;
  attachPlaybackProgressListener();

  void (async () => {
    const trackPlayer = await TP();
    const { position } = await trackPlayer.getProgress();
    if (positionEpoch !== token || trackedLessonId !== lessonId) return;
    setListenProgressBaseline(lessonId, position);
  })().catch((error: unknown) => {
    if (!playerResetting && positionEpoch === token && trackedLessonId === lessonId) {
      usePlayerStore.getState().setPlaybackError(error instanceof Error ? error.message : 'Fortschritt konnte nicht gelesen werden.');
    }
  });

  positionUiPollHandle = setInterval(() => {
    void (async () => {
      if (!usePlayerStore.getState().isPlaying) return;
      const trackPlayer = await TP();
      const { position } = await trackPlayer.getProgress();
      if (positionEpoch !== token || trackedLessonId !== lessonId) return;
      usePlayerStore.getState().setPosition(position);
    })().catch((error: unknown) => {
      if (!playerResetting && positionEpoch === token && trackedLessonId === lessonId) {
        usePlayerStore.getState().setPlaybackError(error instanceof Error ? error.message : 'Fortschritt konnte nicht gelesen werden.');
      }
    });
  }, POSITION_UI_UPDATE_INTERVAL_SECONDS * 1000);

  positionSaveHandle = setInterval(() => {
    const task = (async () => {
      if (playerResetting || !trackedLessonId || positionEpoch !== token) return;
      const trackPlayer = await TP();
      if (playerResetting || positionEpoch !== token) return;
      const { position, duration } = await trackPlayer.getProgress();
      if (playerResetting || positionEpoch !== token || trackedLessonId !== lessonId) return;
      await savePlaybackPosition(lessonId, position);
      if (duration > 0 && position >= duration - 0.5) {
        if (positionEpoch === token && trackedLessonId === lessonId) await markListened(lessonId, position);
      }
    })();
    positionSaveTasks.add(task);
    void task.then(() => positionSaveTasks.delete(task), () => positionSaveTasks.delete(task));
  }, POSITION_SAVE_INTERVAL_SECONDS * 1000);
}

/** Acquires exclusive lifecycle ownership. The returned lease must be released only after the caller's cache/DB phase ends. */
export function clearPlayerAndDownloads(): PlayerResetLease {
  invalidateSeekIntent();
  let core = activePlayerResetLease;
  if (!core) {
    const barrier = claimLifecycleBarrier();
    invalidatePlayerLifecycle();
    core = { ready: serializeLifecycleTransition(clearPlayerAndDownloadsImpl), barrier, owners: new Set(), settled: false };
    activePlayerResetLease = core;
    const createdCore = core;
    const complete = (): void => {
      createdCore.settled = true;
      if (createdCore.owners.size === 0 && activePlayerResetLease === createdCore) {
        activePlayerResetLease = null;
        releaseLifecycleBarrier(createdCore.barrier);
      }
    };
    void createdCore.ready.then(complete, complete);
  }
  const owner = Symbol('player-reset-lease-owner');
  core.owners.add(owner);
  const ownedCore = core;
  return {
    ready: ownedCore.ready,
    release: () => {
      if (!ownedCore.owners.delete(owner)) return;
      if (ownedCore.owners.size === 0 && ownedCore.settled && activePlayerResetLease === ownedCore) {
        activePlayerResetLease = null;
        releaseLifecycleBarrier(ownedCore.barrier);
      }
    },
  };
}

async function clearPlayerAndDownloadsImpl(): Promise<void> {
    downloadEpoch += 1;
    stopPositionTracking();
    clearListenProgressBaselines();
    setSleepTimer(null);
    const tasks = [...activeDownloads.values()];
    await Promise.all(tasks.map((task) => cancelActiveDownload(task)));
    await Promise.allSettled(tasks.map((task) => task.task).filter((task): task is Promise<DownloadResult> => Boolean(task)));
    await Promise.allSettled([...playerOperations]);
    await Promise.allSettled([...positionSaveTasks]);
    if (setupPromise) {
      await setupPromise.catch(() => undefined);
    }
    if (nativeSetupComplete) {
      const trackPlayer = await TP();
      await trackPlayer.reset();
    }
    const { drainLessonProgressWrites } = await import('../data/progress.js');
    await drainLessonProgressWrites();
    const fs = await getContentFs();
    const { deleteAsync } = await import('expo-file-system/legacy');
    await deleteAsync(downloadDirPath(fs.documentDirectory), { idempotent: true });
    usePlayerStore.getState().reset();
}

export function stopPositionTracking(): void {
  positionEpoch += 1;
  if (positionUiPollHandle) {
    clearInterval(positionUiPollHandle);
    positionUiPollHandle = null;
  }
  if (positionSaveHandle) {
    clearInterval(positionSaveHandle);
    positionSaveHandle = null;
  }
  trackedLessonId = null;
}

/** Sichert sofort, für den Pause-Handler (nicht erst im nächsten 5-s-Intervall). */
export async function saveCurrentPositionNow(lessonId: string): Promise<void> {
  if (playerResetting) return;
  const epoch = playerLifecycleEpoch;
  const task = (async () => {
    const trackPlayer = await TP();
    if (playerResetting || epoch !== playerLifecycleEpoch) return;
    const { position } = await trackPlayer.getProgress();
    if (playerResetting || epoch !== playerLifecycleEpoch) return;
    usePlayerStore.getState().setPosition(position);
    await savePlaybackPosition(lessonId, position);
  })();
  positionSaveTasks.add(task);
  try { await task; } finally { positionSaveTasks.delete(task); }
}

/* ------------------------------------------------------------------- Downloads */

export type DownloadResult = 'downloaded' | 'cancelled';

interface ActiveDownload {
  readonly epoch: number;
  readonly controller: AbortController;
  cancelResumable?: () => Promise<void>;
  task?: Promise<DownloadResult>;
}
let downloadEpoch = 0;
const activeDownloads = new Map<string, ActiveDownload>();
const downloadRevisions = new Map<string, number>();
const deletingDownloads = new Set<string>();
function advanceDownloadRevision(lessonId: string): number {
  const revision = (downloadRevisions.get(lessonId) ?? 0) + 1;
  downloadRevisions.set(lessonId, revision);
  return revision;
}
function downloadIsActive(lessonId: string, token: ActiveDownload): boolean {
  return downloadEpoch === token.epoch && activeDownloads.get(lessonId) === token;
}

async function cancelActiveDownload(token: ActiveDownload): Promise<void> {
  token.controller.abort();
  await token.cancelResumable?.().catch(() => undefined);
}

export async function isDownloaded(lessonId: string, pinnedSnapshot?: ContentSnapshot): Promise<boolean> {
  try {
    const fs = await getContentFs();
    const lesson = await getLessonForPlayback(lessonId, pinnedSnapshot ?? await loadContentSnapshot(fs));
    return (await validLocalDownload(fs, lesson)) !== null;
  } catch { return false; }
}

/** MP3 und Cue-Datei nach documentDirectory/audio/ laden, mit Fortschrittsanzeige im Store. */
export async function downloadLesson(lessonId: string): Promise<DownloadResult> {
  if (playerResetting) throw new Error('Player-Reset läuft gerade');
  if (deletingDownloads.has(lessonId)) throw new Error('Downloadänderung läuft');
  const previous = activeDownloads.get(lessonId);
  if (previous?.task) return previous.task;
  advanceDownloadRevision(lessonId);
  const token: ActiveDownload = { epoch: downloadEpoch, controller: new AbortController() };
  activeDownloads.set(lessonId, token);
  const task = (async () => {
    let cleanPartialFiles: (() => Promise<void>) | undefined;
    try {
      const fs = await getContentFs();
      await fs.ensureDirectory(downloadDirPath(fs.documentDirectory));
      // Setup itself is asynchronous: a cancellation/retry may have replaced this token
      // while the adapter was loading or creating the directory.
      if (!downloadIsActive(lessonId, token)) return 'cancelled';
      usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloading', progress: 0, bytesTotal: null });
      const generation = `${Date.now().toString(16).padStart(12, '0')}${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`;
      const stagedAudio = stagedDownloadPath(fs.documentDirectory, lessonId, generation, 'mp3');
      const stagedCues = stagedDownloadPath(fs.documentDirectory, lessonId, generation, 'cues.json');
      const finalAudio = packagedDownloadPath(fs.documentDirectory, lessonId, generation, 'mp3');
      const finalCues = packagedDownloadPath(fs.documentDirectory, lessonId, generation, 'cues.json');
      const stagedMarker = stagedDownloadPath(fs.documentDirectory, lessonId, generation, 'cues.json') + '.marker';
      const publishedMarker = publishedPackagePath(fs.documentDirectory, lessonId, generation);
      const { deleteAsync, createDownloadResumable } = await import('expo-file-system/legacy');
      cleanPartialFiles = async (): Promise<void> => {
        await Promise.all([stagedAudio, stagedCues, stagedMarker, finalAudio, finalCues, publishedMarker]
          .map((path) => deleteAsync(path, { idempotent: true }).catch(() => undefined)));
      };
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      const snapshot = await loadContentSnapshot(fs);
      const lesson = await getLessonForPlayback(lessonId, snapshot);
      const base = await resolveAudioBaseUrl(fs, snapshot);
      const cuesResponse = await fetchTextWithTimeout(remoteCuesUrl(base, lessonId), { signal: token.controller.signal });
      if (!cuesResponse.ok) throw new Error(`Cue-Download fehlgeschlagen (HTTP ${cuesResponse.status})`);
      const cueText = cuesResponse.text;
      validateCueText(cueText, lesson);
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      await fs.writeFile(stagedCues, cueText);
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }

      const resumable = createDownloadResumable(remoteAudioUrl(base, lessonId), stagedAudio, {}, (p) => {
        if (!downloadIsActive(lessonId, token)) return;
        const bytesTotal = p.totalBytesExpectedToWrite;
        const progress = bytesTotal > 0 ? Math.min(1, p.totalBytesWritten / bytesTotal) : 0;
        usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloading', progress, bytesTotal: bytesTotal > 0 ? bytesTotal : null });
      });
      token.cancelResumable = () => resumable.cancelAsync().then(() => undefined);
      const result = await resumable.downloadAsync();
      if (!result || !downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      if (result.status < 200 || result.status >= 300) throw new Error(`Audio-Download fehlgeschlagen (HTTP ${result.status})`);
      const audioBytes = await fs.getFileSize(stagedAudio);
      if (audioBytes === null || audioBytes < 1024) throw new Error('Audio-Datei ist leer oder unvollständig');
      const audioPrefix = await fs.readFilePrefixBase64(stagedAudio, 64);
      if (!isPlausibleMp3Prefix(audioPrefix)) throw new Error('Audio-Datei hat keinen gültigen MP3-Anfang');
      const cuesBytes = await fs.getFileSize(stagedCues);
      if (cuesBytes === null || cuesBytes < 2) throw new Error('Cue-Datei fehlt');
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      await fs.moveFile(stagedAudio, finalAudio);
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      await fs.moveFile(stagedCues, finalCues);
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      const marker = {
        version: 1,
        lessonId,
        generation,
        audioFile: `${lessonId}.${generation}.mp3`,
        audioBytes,
        audioPrefix,
        cuesFile: `${lessonId}.${generation}.cues.json`,
        cuesBytes,
        cuesChecksum: checksumCueText(cueText),
      } as const;
      await fs.writeFile(stagedMarker, JSON.stringify(marker));
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      await fs.moveFile(stagedMarker, publishedMarker);
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      const verified = await validLocalDownloadCandidate(fs, lesson, publishedMarker);
      if (!verified || verified.audioPath !== finalAudio) throw new Error('Downloadpaket konnte nach Veröffentlichung nicht validiert werden');
      if (!downloadIsActive(lessonId, token)) { await cleanPartialFiles(); return 'cancelled'; }
      usePlayerStore.getState().setDownloadState({ lessonId, status: 'downloaded', progress: 1, bytesTotal: null });
      return 'downloaded';
    } catch (error) {
      await cleanPartialFiles?.();
      if (!downloadIsActive(lessonId, token)) return 'cancelled';
      usePlayerStore.getState().setDownloadState({ lessonId, status: 'error', progress: 0, bytesTotal: null, error: error instanceof Error ? error.message : 'Unbekannter Downloadfehler' });
      throw error;
    } finally {
      if (activeDownloads.get(lessonId) === token) activeDownloads.delete(lessonId);
    }
  })();
  token.task = task;
  return task;
}

export async function cancelDownload(lessonId: string): Promise<void> {
  if (playerResetting) return;
  const active = activeDownloads.get(lessonId);
  if (!active) return;
  const revision = advanceDownloadRevision(lessonId);
  const lifecycleEpoch = downloadEpoch;
  activeDownloads.delete(lessonId);
  await cancelActiveDownload(active);
  await active.task?.catch(() => undefined);
  const exists = await isDownloaded(lessonId).catch(() => false);
  if (downloadRevisions.get(lessonId) === revision && downloadEpoch === lifecycleEpoch && !playerResetting && !activeDownloads.has(lessonId)) {
    usePlayerStore.getState().setDownloadState(exists
      ? { lessonId, status: 'downloaded', progress: 1, bytesTotal: null }
      : { lessonId, status: 'not-downloaded', progress: 0, bytesTotal: null });
  }
}

export async function deleteDownload(lessonId: string): Promise<void> {
  if (playerResetting) throw new Error('Player-Reset läuft gerade');
  if (deletingDownloads.has(lessonId)) throw new Error('Downloadänderung läuft');
  const revision = advanceDownloadRevision(lessonId);
  const lifecycleEpoch = downloadEpoch;
  deletingDownloads.add(lessonId);
  try {
  const active = activeDownloads.get(lessonId);
  if (active) {
    activeDownloads.delete(lessonId);
    await cancelActiveDownload(active);
    await active.task?.catch(() => undefined);
  }
  const fs = await getContentFs();
  const { deleteAsync } = await import('expo-file-system/legacy');
  const prefix = `${lessonId}.`;
  const dotPrefix = `.${lessonId}.`;
  const names = await fs.listDirectory(downloadDirPath(fs.documentDirectory));
  await Promise.all(names.filter((name) => name.startsWith(prefix) || name.startsWith(dotPrefix))
    .map((name) => deleteAsync(`${downloadDirPath(fs.documentDirectory)}${name}`, { idempotent: true })));
  await Promise.all([downloadedAudioPath(fs.documentDirectory, lessonId), downloadedCuesPath(fs.documentDirectory, lessonId)]
    .map((path) => deleteAsync(path, { idempotent: true })));
  if (downloadRevisions.get(lessonId) === revision && downloadEpoch === lifecycleEpoch && !playerResetting && !activeDownloads.has(lessonId)) {
    usePlayerStore.getState().setDownloadState({ lessonId, status: 'not-downloaded', progress: 0, bytesTotal: null });
  }
  } finally { deletingDownloads.delete(lessonId); }
}

/** Summiert die Bytes aller lokalen Audio- und Cue-Dateien fuer die angegebenen Lektionen. */
export async function getDownloadedStorageBytes(lessonIds: readonly string[]): Promise<number | null> {
  if (lessonIds.length === 0) return null;
  const fs = await getContentFs();
  const snapshot = await loadContentSnapshot(fs);
  let total = 0;
  let found = false;
  for (const lessonId of lessonIds) {
    try {
    const lesson = await getLessonForPlayback(lessonId, snapshot);
      const local = await validLocalDownload(fs, lesson);
      if (!local) continue;
      for (const path of [local.audioPath, local.cuesPath]) {
        const size = await fs.getFileSize(path);
        if (size !== null) { total += size; found = true; }
      }
    } catch { /* invalid/unavailable item is not counted as an offline download */ }
  }
  return found ? total : null;
}

export { usePlayerStore } from './store.js';
export * from './types.js';
export { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from './types.js';
