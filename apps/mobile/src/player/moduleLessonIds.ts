import { getContentFs } from '../content/contentFs.js';
import { loadLocalManifest } from '../content/lessonLoader.js';

export function moduleIdFromLessonId(lessonId: string): string {
  const dash = lessonId.indexOf('-');
  return dash > 0 ? lessonId.slice(0, dash) : lessonId;
}

/** Veröffentlichte Lektions-IDs eines Moduls, sortiert (wie enqueueModule). */
export async function lessonIdsInModule(moduleId: string): Promise<string[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  return (manifest?.lessons ?? [])
    .map((l) => l.id)
    .filter((id) => id.startsWith(`${moduleId}-`))
    .sort();
}

/** Aktuelle Lektion plus alle folgenden im selben Modul. */
export async function lessonIdsFromLessonInModule(lessonId: string): Promise<string[]> {
  const moduleId = moduleIdFromLessonId(lessonId);
  const ids = await lessonIdsInModule(moduleId);
  const start = ids.indexOf(lessonId);
  if (start < 0) return [lessonId];
  return ids.slice(start);
}
