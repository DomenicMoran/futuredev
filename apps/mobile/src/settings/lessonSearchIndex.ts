import type { ContentFs } from '../content/types.js';
import type { ModuleListEntry } from '../content/listLessons.js';
import { loadContentSnapshot, type ContentSnapshot } from '../content/generation.js';
import { loadLesson } from '../content/lessonLoader.js';
import { createLessonSearchEntry, type LessonSearchEntry } from './lessonSearch.js';

export interface LessonSearchIndexSnapshot {
  snapshot: ContentSnapshot;
  entries: LessonSearchEntry[];
}

/** Builds a search index from one manifest/modules generation and pins all lesson reads to it. */
export async function loadLessonSearchIndex(
  fs: ContentFs,
  fallbackModules: readonly ModuleListEntry[] = [],
): Promise<LessonSearchIndexSnapshot> {
  const snapshot = await loadContentSnapshot(fs);
  const sources = snapshot.manifest && snapshot.modules
    ? snapshot.modules.modules.flatMap((module) => module.subModules.flatMap((submodule) => {
      const ids = snapshot.manifest?.lessons.map((lesson) => lesson.id)
        .filter((id) => id.startsWith(`${submodule.id}-`)).sort() ?? [];
      return ids.map((id) => ({ id, title: id, moduleTitle: module.title, submoduleTitle: submodule.title }));
    }))
    : fallbackModules.flatMap((module) => module.subModules.flatMap((submodule) => submodule.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleTitle: module.title,
      submoduleTitle: submodule.title,
    }))));

  const entries = await Promise.all(sources.map(async (source) => {
    const lesson = await loadLesson(fs, source.id, { bundledFallback: true, snapshot, preferBundledRevision: true });
    return createLessonSearchEntry(source.id, lesson?.title ?? source.title, source.moduleTitle, source.submoduleTitle, lesson);
  }));
  return { snapshot, entries };
}
