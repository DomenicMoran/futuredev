import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { lessonSchema } from './lesson.js';
import { modulesFileSchema, type ModulesFile } from './modules.js';
import { manifestSchema, type Manifest } from './manifest.js';

export interface ManifestSourceLesson {
  file: string;
  bytes: Uint8Array;
  updatedAt: string;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function compareSemver(left: string, right: string): number {
  const parse = (version: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid semantic version: ${version}`);
    return version.split('.').map(Number);
  };
  const a = parse(left); const b = parse(right);
  for (let i = 0; i < 3; i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

export function buildManifest(input: {
  version: string;
  contentBaseUrl: string;
  audioBaseUrl: string;
  rawModules: Uint8Array;
  lessons: readonly ManifestSourceLesson[];
}): Manifest {
  const modulesText = new TextDecoder('utf-8', { fatal: true }).decode(input.rawModules);
  const modulesResult = modulesFileSchema.safeParse(JSON.parse(modulesText));
  if (!modulesResult.success) throw new Error('modules.json does not match modulesFileSchema');
  const expectedModuleIds = Array.from({ length: 10 }, (_, index) => `M${String(index + 1).padStart(2, '0')}`);
  const actualModuleIds = modulesResult.data.modules.map((module) => module.id).sort();
  if (new Set(actualModuleIds).size !== 10 || actualModuleIds.some((id, index) => id !== expectedModuleIds[index])) {
    throw new Error('modules.json must contain each module M01 through M10 exactly once');
  }
  const submoduleIds = new Set<string>();
  for (const module of modulesResult.data.modules) {
    for (const submodule of module.subModules) {
      if (!submodule.id.startsWith(`${module.id}-`) || submoduleIds.has(submodule.id)) throw new Error(`Invalid or duplicate submodule ${submodule.id}`);
      submoduleIds.add(submodule.id);
    }
  }
  const moduleMap = new Map(modulesResult.data.modules.map((module) => [module.id, new Set(module.subModules.map((sub) => sub.id))]));
  const seen = new Set<string>();
  const prereqsById = new Map<string, readonly string[]>();
  const manifestLessons: Manifest['lessons'] = [];

  for (const source of [...input.lessons].sort((a, b) => a.file.localeCompare(b.file))) {
    if (!/^[A-Za-z0-9-]+\.json$/.test(source.file)) throw new Error(`Unsafe content filename: ${source.file}`);
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes);
    const result = lessonSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw new Error(`Lesson ${source.file} does not match lessonSchema`);
    const lesson = result.data;
    if (source.file !== `${lesson.id}.json`) throw new Error(`Lesson ID ${lesson.id} does not match filename ${source.file}`);
    if (seen.has(lesson.id)) throw new Error(`Duplicate lesson ID: ${lesson.id}`);
    seen.add(lesson.id);
    prereqsById.set(lesson.id, lesson.prerequisites);
    const subModules = moduleMap.get(lesson.id.slice(0, 3));
    if (!subModules?.has(lesson.id.slice(0, 6))) throw new Error(`Lesson ${lesson.id} has no module/submodule entry`);
    if (!Number.isFinite(Date.parse(source.updatedAt))) throw new Error(`Invalid updatedAt for ${lesson.id}`);
    manifestLessons.push({ id: lesson.id, file: source.file, sha256: sha256Bytes(source.bytes), updatedAt: source.updatedAt });
  }
  for (const [lessonId, prerequisites] of prereqsById) {
    for (const prerequisite of prerequisites) if (!seen.has(prerequisite)) throw new Error(`Missing prerequisite ${prerequisite} referenced by ${lessonId}`);
  }
  if (manifestLessons.length === 0) throw new Error('Refusing to generate an empty content release');
  return manifestSchema.parse({
    version: input.version,
    contentBaseUrl: input.contentBaseUrl,
    audioBaseUrl: input.audioBaseUrl,
    modulesSha256: sha256Bytes(input.rawModules),
    lessons: manifestLessons,
  });
}

export function parseModules(raw: string): ModulesFile {
  return modulesFileSchema.parse(JSON.parse(raw));
}
