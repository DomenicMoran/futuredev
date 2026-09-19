// Reine Planungslogik ohne Netzwerk und ohne Dateisystem: aus dem lokalen und
// dem zuletzt veroeffentlichten Manifest wird berechnet, was hochgeladen
// werden muesste. Getrennt von publish.ts, damit Vitest sie ohne
// Supabase-Client und ohne echte Dateien pruefen kann.
import type { Manifest, ManifestLesson } from '@futuredev/content-schema';
import { shortHash } from './hash.js';

/** Bucket-relativer Pfad einer Lektion im Eimer "content", unveraenderlich je Pruefsumme. */
export function lessonStoragePath(id: string, sha256: string): string {
  return `lessons/${id}.${shortHash(sha256)}.json`;
}

export interface LessonUploadPlan {
  readonly id: string;
  readonly path: string;
  readonly reason: 'neu' | 'geaendert';
}

/**
 * Welche Lektionen sich gegenueber dem zuletzt veroeffentlichten Manifest
 * geaendert haben (Pruefsummenvergleich je Lektionskennung). Eine Lektion, die
 * im zuletzt veroeffentlichten Manifest fehlt, gilt als neu.
 */
export function diffLessons(local: Manifest, remote: Manifest | null): LessonUploadPlan[] {
  const remoteById = new Map(remote?.lessons.map((lesson) => [lesson.id, lesson]) ?? []);
  const uploads: LessonUploadPlan[] = [];
  for (const lesson of local.lessons) {
    const previous = remoteById.get(lesson.id);
    const reason: LessonUploadPlan['reason'] | null = !previous
      ? 'neu'
      : previous.sha256 !== lesson.sha256
        ? 'geaendert'
        : null;
    if (reason) {
      uploads.push({ id: lesson.id, path: lessonStoragePath(lesson.id, lesson.sha256), reason });
    }
  }
  return uploads;
}

/**
 * Das Manifest, wie es tatsaechlich in den Eimer "content" geladen wird: das
 * Feld "file" zeigt auf den unveraenderlichen, pruefsummenbehafteten Pfad
 * (lessons/<id>.<kurz>.json) statt auf den lokalen Dateinamen unter
 * content/lessons/. Nur so darf die Lektionsdatei mit cacheControl 31536000s
 * (ein Jahr) ausgeliefert werden, ohne dass ein Client unter demselben Namen
 * jemals eine veraltete Fassung bekommt.
 *
 * `contentBaseUrl`/`audioBaseUrl` werden dabei auf die Supabase-Eimer
 * umgeschrieben (siehe Nachtrag 2026-09-19: `content/manifest.json` traegt
 * lokal noch die GitHub-Uebergangsadressen aus Welle 3, Agent C). Ohne diese
 * Umschreibung wuerde das veroeffentlichte Manifest weiter auf GitHub zeigen,
 * obwohl die Lektionsdateien selbst im Supabase-Eimer "content" liegen.
 */
export function buildPublishManifest(local: Manifest, supabaseUrl: string): Manifest {
  const base = supabaseUrl.replace(/\/+$/, '');
  return {
    ...local,
    contentBaseUrl: `${base}/storage/v1/object/public/content`,
    audioBaseUrl: `${base}/storage/v1/object/public/audio`,
    lessons: local.lessons.map((lesson) => ({
      ...lesson,
      file: lessonStoragePath(lesson.id, lesson.sha256),
    })),
  };
}

function manifestLessonsEqual(a: readonly ManifestLesson[], b: readonly ManifestLesson[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((lesson) => [lesson.id, lesson]));
  return a.every((lesson) => {
    const other = byId.get(lesson.id);
    return (
      other !== undefined &&
      other.file === lesson.file &&
      other.sha256 === lesson.sha256 &&
      other.updatedAt === lesson.updatedAt
    );
  });
}

/**
 * Ob sich das zu veroeffentlichende Manifest (mit umgeschriebenen Pfaden)
 * gegenueber dem zuletzt veroeffentlichten Stand aendert.
 */
export function manifestChanged(publishManifest: Manifest, remote: Manifest | null): boolean {
  if (!remote) return true;
  return (
    publishManifest.version !== remote.version ||
    publishManifest.contentBaseUrl !== remote.contentBaseUrl ||
    publishManifest.audioBaseUrl !== remote.audioBaseUrl ||
    !manifestLessonsEqual(publishManifest.lessons, remote.lessons)
  );
}

export type ContentPlanStep =
  | { readonly kind: 'lesson'; readonly id: string; readonly path: string; readonly reason: 'neu' | 'geaendert' }
  | { readonly kind: 'manifest'; readonly changed: boolean };

/**
 * Reihenfolge fest: erst alle Lektionen, dann das Manifest. So kann ein
 * Abbruch mitten im Lauf nie ein Manifest veroeffentlichen, das auf eine
 * Lektionsdatei zeigt, die noch nicht im Eimer liegt.
 */
export function planContentUploads(local: Manifest, remote: Manifest | null, supabaseUrl: string): ContentPlanStep[] {
  const lessonSteps: ContentPlanStep[] = diffLessons(local, remote).map((upload) => ({
    kind: 'lesson',
    ...upload,
  }));
  const publishManifest = buildPublishManifest(local, supabaseUrl);
  return [...lessonSteps, { kind: 'manifest', changed: manifestChanged(publishManifest, remote) }];
}

/* ------------------------------------------------------------------ Audio */

export interface AudioLocalInfo {
  readonly id: string;
  readonly mp3Exists: boolean;
  readonly mp3Sha256: string | null;
  readonly cuesExists: boolean;
  readonly cuesSha256: string | null;
}

export type AudioPlanStep =
  | { readonly kind: 'audio-mp3'; readonly id: string; readonly reason: 'neu' | 'geaendert' }
  | { readonly kind: 'audio-cues'; readonly id: string; readonly reason: 'neu' | 'geaendert' }
  | { readonly kind: 'audio-skip'; readonly id: string; readonly reason: string };

/**
 * remoteMp3Sha/remoteCuesSha: Pruefsummen aus den Sidecar-Dateien
 * "<id>.sha256" und "<id>.cues.sha256" im Eimer "audio", falls dort vorhanden.
 * Fehlt die Cue-Datei lokal (Agent C erzeugt sie in der Vertonungspipeline),
 * wird die Lektion uebersprungen und gemeldet; ein spaeterer Lauf mit
 * vorhandener Cue-Datei laedt dann beides nach.
 */
export function planAudioUploads(
  lessons: readonly { readonly id: string }[],
  localInfo: ReadonlyMap<string, AudioLocalInfo>,
  remoteMp3Sha: ReadonlyMap<string, string>,
  remoteCuesSha: ReadonlyMap<string, string>,
): AudioPlanStep[] {
  const steps: AudioPlanStep[] = [];
  for (const lesson of lessons) {
    const info = localInfo.get(lesson.id);
    if (!info || !info.mp3Exists) {
      steps.push({ kind: 'audio-skip', id: lesson.id, reason: 'keine MP3 im Audio-Ordner gefunden' });
      continue;
    }
    if (!info.cuesExists) {
      steps.push({
        kind: 'audio-skip',
        id: lesson.id,
        reason: 'keine Cue-Datei (<id>.cues.json) gefunden, wird von der Vertonungspipeline erzeugt',
      });
      continue;
    }

    const previousMp3Sha = remoteMp3Sha.get(lesson.id);
    if (previousMp3Sha === undefined || previousMp3Sha !== info.mp3Sha256) {
      steps.push({ kind: 'audio-mp3', id: lesson.id, reason: previousMp3Sha === undefined ? 'neu' : 'geaendert' });
    }

    const previousCuesSha = remoteCuesSha.get(lesson.id);
    if (previousCuesSha === undefined || previousCuesSha !== info.cuesSha256) {
      steps.push({ kind: 'audio-cues', id: lesson.id, reason: previousCuesSha === undefined ? 'neu' : 'geaendert' });
    }
  }
  return steps;
}
