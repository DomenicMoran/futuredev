import { lessonSchema, modulesFileSchema, manifestSchema, type Lesson, type Manifest, type ModulesFile } from '@futuredev/content-schema';
import type { ContentFs } from './types.js';
import { CONTENT_DIR_NAME, LESSONS_DIR_NAME } from './contentFs.js';

function contentDir(fs: ContentFs): string {
  return `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
}
function lessonsDir(fs: ContentFs): string {
  return `${contentDir(fs)}${LESSONS_DIR_NAME}/`;
}

/** Liest die lokal gespeicherte Lektion (nach Erststart-Kopie oder Nachladen). */
export async function loadLesson(fs: ContentFs, id: string): Promise<Lesson | null> {
  const path = `${lessonsDir(fs)}${id}.json`;
  if (!(await fs.exists(path))) return null;
  const raw = await fs.readFile(path);
  const parsed = lessonSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  return parsed.data;
}

export async function saveLesson(fs: ContentFs, id: string, lesson: unknown): Promise<void> {
  await fs.ensureDirectory(lessonsDir(fs));
  await fs.writeFile(`${lessonsDir(fs)}${id}.json`, JSON.stringify(lesson));
}

export async function loadLocalManifest(fs: ContentFs): Promise<Manifest | null> {
  const path = `${contentDir(fs)}manifest.json`;
  if (!(await fs.exists(path))) return null;
  const raw = await fs.readFile(path);
  const parsed = manifestSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function saveLocalManifest(fs: ContentFs, manifest: Manifest): Promise<void> {
  await fs.ensureDirectory(contentDir(fs));
  await fs.writeFile(`${contentDir(fs)}manifest.json`, JSON.stringify(manifest));
}

export async function loadModules(fs: ContentFs): Promise<ModulesFile | null> {
  const path = `${contentDir(fs)}modules.json`;
  if (!(await fs.exists(path))) return null;
  const raw = await fs.readFile(path);
  const parsed = modulesFileSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}
