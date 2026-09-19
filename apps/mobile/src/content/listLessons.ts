import type { Manifest, ModulesFile } from '@futuredev/content-schema';
import type { LessonState } from '@futuredev/core';
import { listProgress } from '../data/progress.js';
import { loadLesson } from './lessonLoader.js';
import type { ContentFs } from './types.js';

export interface LessonListEntry {
  id: string;
  title: string;
  durationMinutes: number;
  available: boolean; // im Manifest gelistet (Technikvorgabe 4: kein Platzhalter fuer Unveroeffentlichtes)
  state: LessonState;
}

export interface SubModuleListEntry {
  id: string;
  title: string;
  lessons: LessonListEntry[];
}

export interface ModuleListEntry {
  id: string;
  title: string;
  subModules: SubModuleListEntry[];
  totalLessons: number;
  completedLessons: number;
}

/**
 * Baut die Modulliste fuer den Reiter Lernen: Module M01 bis M10 aus
 * `modules.json` (immer alle zehn, fest), Lektionen darunter nur, wenn sie im
 * Manifest tatsaechlich veroeffentlicht sind, mit Fortschrittszustand aus
 * SQLite. Module ohne veroeffentlichte Lektion bleiben sichtbar
 * ("in Vorbereitung"), siehe inhaltsformat.md.
 */
export async function buildModuleList(
  modules: ModulesFile,
  manifest: Manifest | null,
  fs?: ContentFs,
): Promise<ModuleListEntry[]> {
  const publishedIds = new Set((manifest?.lessons ?? []).map((l) => l.id));
  const progressRows = await listProgress();
  const stateByLessonId = new Map(progressRows.map((row) => [row.lessonId, row.state]));

  const result: ModuleListEntry[] = [];
  for (const module of modules.modules) {
    let totalLessons = 0;
    let completedLessons = 0;
    const subModules = [];
    for (const subModule of module.subModules) {
      // Lektionskennungen dieses Untermoduls sind alle veroeffentlichten
      // Lektionen, deren Kennung mit "<subModuleId>-" beginnt.
      const ids = [...publishedIds].filter((id) => id.startsWith(`${subModule.id}-`)).sort();
      const lessons: LessonListEntry[] = [];
      for (const id of ids) {
        const state = stateByLessonId.get(id) ?? 'new';
        totalLessons += 1;
        if (state === 'completed') completedLessons += 1;
        const lesson = fs ? await loadLesson(fs, id) : null;
        lessons.push({
          id,
          title: lesson?.title ?? id,
          durationMinutes: lesson?.durationMinutes ?? 0,
          available: true,
          state,
        });
      }
      subModules.push({ id: subModule.id, title: subModule.title, lessons });
    }
    result.push({ id: module.id, title: module.title, subModules, totalLessons, completedLessons });
  }
  return result;
}
