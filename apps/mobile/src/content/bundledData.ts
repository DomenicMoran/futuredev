import { lessonSchema, manifestSchema, modulesFileSchema, type Lesson } from '@futuredev/content-schema';
import { bundledLessonRaw, bundledManifestRaw, bundledModulesRaw } from '../../assets/content/bundled.generated.js';
import type { BundledContent } from './bundledContent.js';

export interface BundledRawExports {
  bundledManifestRaw: string;
  bundledModulesRaw: string;
  bundledLessonRaw: Record<string, string>;
}

/** One schema-validated access seam shared by boot, lesson lists, decks and profile. */
export function createBundledAccessors(raw: BundledRawExports) {
  const manifest = manifestSchema.parse(JSON.parse(raw.bundledManifestRaw));
  const modules = modulesFileSchema.parse(JSON.parse(raw.bundledModulesRaw));
  const lessonCache = new Map<string, Lesson>();
  const lessons: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(raw.bundledLessonRaw)) {
    const parsed = lessonSchema.safeParse(JSON.parse(value));
    if (parsed.success && parsed.data.id === id) lessons[id] = parsed.data;
  }
  return {
    manifest,
    modules,
    bundledContent: { manifest, modules, lessons } satisfies BundledContent,
    lesson(id: string): Lesson | null {
      const cached = lessonCache.get(id);
      if (cached) return cached;
      const value = raw.bundledLessonRaw[id];
      if (value === undefined) return null;
      const parsed = lessonSchema.safeParse(JSON.parse(value));
      if (!parsed.success || parsed.data.id !== id) return null;
      lessonCache.set(id, parsed.data);
      return parsed.data;
    },
  };
}

export { bundledManifestRaw, bundledModulesRaw, bundledLessonRaw };

export const bundledAccessors = createBundledAccessors({ bundledManifestRaw, bundledModulesRaw, bundledLessonRaw });
export const bundledManifest = bundledAccessors.manifest;
export const bundledModules = bundledAccessors.modules;
export const bundledContent = bundledAccessors.bundledContent;
export const getBundledLesson = bundledAccessors.lesson;
