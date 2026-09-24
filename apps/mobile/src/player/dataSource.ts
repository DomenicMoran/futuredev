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
import { getProgress, markLessonState } from '../data/index.js';
import { accumulateListenProgress } from '../settings/dailyLearning.js';
import { getContentFs } from '../content/contentFs.js';
import { loadLesson, loadLocalManifest } from '../content/lessonLoader.js';

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

async function fetchRemoteLesson(lessonId: string): Promise<Lesson> {
  const fs = await getContentFs();
  const localManifest = await loadLocalManifest(fs);
  const base = resolveContentBaseUrl(localManifest);
  const trimmedBase = base.replace(/\/$/, '');
  if (!trimmedBase) {
    throw new Error(
      `getLessonForPlayback: ${lessonId} liegt nicht lokal vor und EXPO_PUBLIC_CONTENT_BASE_URL ist nicht gesetzt`,
    );
  }
  const entry = localManifest?.lessons.find((l) => l.id === lessonId);
  const fileName = entry?.file ?? `${lessonId}.json`;
  const response = await fetch(`${trimmedBase}/lessons/${fileName}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`getLessonForPlayback: Lektionsabruf fehlgeschlagen (HTTP ${response.status})`);
  }
  // safeParse statt parse: ein ungueltiges Manifest/eine ungueltige
  // Basis-URL (Pruefbericht Phase 3, B-01) darf nie als unbehandelter
  // ZodError bis zur Oberflaeche durchschlagen, sondern wird als normaler
  // Error mit klarer Meldung gemeldet, den die Aufrufer bereits abfangen.
  const parsed = lessonSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`getLessonForPlayback: ${lessonId} entspricht nicht dem Lektionsschema`);
  }
  return parsed.data;
}

/** Lädt eine Lektion für die Wiedergabe: lokal (nach Erststart-Kopie/Sync) vor Netz. */
export async function getLessonForPlayback(lessonId: string): Promise<Lesson> {
  const fs = await getContentFs();
  const local = await loadLesson(fs, lessonId);
  if (local) return local;
  return fetchRemoteLesson(lessonId);
}

/** Sichert die Hörposition (progress.listenedUntil), alle 5 s bzw. sofort bei Pause. */
export async function savePlaybackPosition(lessonId: string, seconds: number): Promise<void> {
  const totalToday = await accumulateListenProgress(lessonId, seconds);
  const { useSettingsStore } = await import('../state/settings.js');
  useSettingsStore.getState().setDailyLearningSecondsToday(totalToday);
  const existing = await getProgress(lessonId);
  const nextState = existing?.state === 'new' ? 'started' : (existing?.state ?? 'started');
  await markLessonState(lessonId, nextState, { listenedUntil: Math.round(seconds) });
}

/**
 * Setzt den Zustand 'listened' bei 100 Prozent. Zwei Schritte (new→started,
 * dann →listened): ALLOWED_TRANSITIONS in @futuredev/core erlaubt von 'new'
 * aus nur 'started', ein einzelner Sprung auf 'listened' würde also
 * stillschweigend ignoriert.
 */
export async function markListened(lessonId: string, seconds: number): Promise<void> {
  await savePlaybackPosition(lessonId, seconds);
  await markLessonState(lessonId, 'listened', { listenedUntil: Math.round(seconds) });
}
