import { lessonSchema, modulesFileSchema, manifestSchema, type Lesson, type Manifest, type ModulesFile } from '@futuredev/content-schema';
import type { ContentFs } from './types.js';
import { CONTENT_DIR_NAME, LESSONS_DIR_NAME } from './contentFs.js';
import { digestUtf8, type ContentSnapshot } from './generation.js';
import { bundledManifest, getBundledLesson } from './bundledData.js';

function contentDir(fs: ContentFs): string {
  return `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
}
function lessonsDir(fs: ContentFs): string {
  return `${contentDir(fs)}${LESSONS_DIR_NAME}/`;
}

async function readVerifiedLesson(
  fs: ContentFs,
  root: string,
  id: string,
  manifest: Manifest | null,
): Promise<Lesson | null> {
  const path = `${root}${LESSONS_DIR_NAME}/${id}.json`;
  if (!(await fs.exists(path))) return null;
  let raw: string;
  try {
    raw = await fs.readFile(path);
  } catch {
    return null;
  }
  const entry = manifest?.lessons.find((lesson) => lesson.id === id);
  if (entry && digestUtf8(raw) !== entry.sha256) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = lessonSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.id !== id) return null;
  return parsed.data;
}

/** Liest die lokal gespeicherte Lektion (nach Erststart-Kopie oder Nachladen). */
export interface LoadLessonOptions {
  /** Gebuendelte Erststart-Kopie, wenn die Datei noch nicht im Dokumentverzeichnis liegt (Modulliste, Start). */
  bundledFallback?: boolean;
  /** Pinnt alle Reads an eine bereits geladene Generationswurzel. */
  snapshot?: ContentSnapshot;
}

export async function loadLesson(fs: ContentFs, id: string, options?: LoadLessonOptions): Promise<Lesson | null> {
  const snapshot = options?.snapshot;
  if (snapshot) {
    const fromSnapshot = await readVerifiedLesson(fs, snapshot.root, id, snapshot.manifest);
    if (fromSnapshot) return fromSnapshot;
    return null;
  }

  const manifest = await loadLocalManifest(fs);
  const fromLegacy = await readVerifiedLesson(fs, contentDir(fs), id, manifest);
  if (fromLegacy) return fromLegacy;

  if (options?.bundledFallback) return getBundledLesson(id);
  return null;
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

/** Manifest der gebuendelten Erststart-Fassung (Offline-Fallback fuer Profil/IDs). */
export function bundledFallbackManifest(): Manifest {
  return bundledManifest;
}
