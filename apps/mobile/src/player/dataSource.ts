// Schmale Schnittstelle zu Agent B's Datenzugriff (src/data) und
// Inhaltsladen (src/content), wie im Auftrag vorgegeben: die Bindung an das,
// was im Ordner liegt, ist inzwischen möglich (siehe Bericht: beide Ordner
// waren zu Beginn der Arbeit noch leer, während der Umsetzung sind sie
// gefüllt worden). getLessonForPlayback bindet an `loadLesson`/`loadModules`
// (src/content/lessonLoader.ts) plus einen Netz-Nachschlag über das Manifest,
// falls eine Lektion lokal noch fehlt; savePlaybackPosition/markListened
// binden an `getProgress`/`markLessonState` (src/data/progress.ts), die schon
// die Felder aus datenmodell.md tragen (listenedUntil).
import { lessonSchema, type Lesson, type Manifest } from '@futuredev/content-schema';
import { markLessonListened, saveListenPosition } from '../data/progress.js';
import { accumulateListenProgress } from '../settings/dailyLearning.js';
import { getContentFs } from '../content/contentFs.js';
import { loadLesson } from '../content/lessonLoader.js';
import { loadContentSnapshot, type ContentSnapshot } from '../content/generation.js';
import { fetchVerifiedFile } from '../content/verifiedFile.js';

/**
 * Basis-URL kommt vorrangig aus dem Manifest (lokal abgelegt nach
 * Erststart-Kopie/Sync, gleiches Muster wie content/sync.ts:25-28).
 * `EXPO_PUBLIC_CONTENT_BASE_URL` bleibt als Override fuer lokale
 * Entwicklung/Tests erhalten, ist in der gebauten Expo-App aber leer
 * (B-01) — ohne den Manifest-Fallback blieb der Lektionsabruf dort ohne
 * lokale Kopie immer ohne Basis-URL stehen.
 */
export function resolveContentBaseUrl(localManifest: Manifest | null): string {
  return process.env.EXPO_PUBLIC_CONTENT_BASE_URL ?? localManifest?.contentBaseUrl ?? '';
}

async function fetchRemoteLesson(lessonId: string, snapshot: ContentSnapshot): Promise<Lesson> {
  const entry = snapshot.manifest?.lessons.find((lesson) => lesson.id === lessonId);
  if (!entry || entry.file !== `${lessonId}.json`) {
    throw new Error(`getLessonForPlayback: ${lessonId} ist im gepinnten Manifest nicht veröffentlicht`);
  }
  const base = resolveContentBaseUrl(snapshot.manifest);
  const trimmedBase = base.replace(/\/$/, '');
  if (!trimmedBase) {
    throw new Error(
      `getLessonForPlayback: ${lessonId} liegt nicht lokal vor und es ist keine Inhaltsbasis-URL gesetzt`,
    );
  }
  const raw = await fetchVerifiedFile(`${trimmedBase}/lessons/${entry.file}`, entry.sha256);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`getLessonForPlayback: ${lessonId} enthält kein gültiges JSON`); }
  const parsed = lessonSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`getLessonForPlayback: ${lessonId} entspricht nicht dem Lektionsschema`);
  }
  if (parsed.data.id !== lessonId) throw new Error(`getLessonForPlayback: Lektionskennung stimmt bei ${entry.file} nicht überein`);
  return parsed.data;
}

/** Lädt eine Lektion für die Wiedergabe: lokal (nach Erststart-Kopie/Sync) vor Netz. */
export async function getLessonForPlayback(lessonId: string, pinnedSnapshot?: ContentSnapshot): Promise<Lesson> {
  const fs = await getContentFs();
  const snapshot = pinnedSnapshot ?? await loadContentSnapshot(fs);
  const local = await loadLesson(fs, lessonId, { snapshot });
  if (local) return local;
  return fetchRemoteLesson(lessonId, snapshot);
}

/** Sichert die Hörposition (progress.listenedUntil), alle 5 s bzw. sofort bei Pause. */
export async function savePlaybackPosition(lessonId: string, seconds: number): Promise<void> {
  const totalToday = await accumulateListenProgress(lessonId, seconds);
  const { useSettingsStore } = await import('../state/settings.js');
  useSettingsStore.getState().setDailyLearningSecondsToday(totalToday);
  await saveListenPosition(lessonId, seconds);
}

/**
 * Setzt den Zustand 'listened' bei 100 Prozent. Zwei Schritte (new→started,
 * dann →listened): ALLOWED_TRANSITIONS in @futuredev/core erlaubt von 'new'
 * aus nur 'started', ein einzelner Sprung auf 'listened' würde also
 * stillschweigend ignoriert.
 */
export async function markListened(lessonId: string, seconds: number): Promise<void> {
  const totalToday = await accumulateListenProgress(lessonId, seconds);
  const { useSettingsStore } = await import('../state/settings.js');
  useSettingsStore.getState().setDailyLearningSecondsToday(totalToday);
  await markLessonListened(lessonId, seconds);
}
