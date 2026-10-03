import { lessonSchema, type Lesson, type Manifest, type ModulesFile } from '@futuredev/content-schema';
import type { ContentFs } from './types.js';
import { CONTENT_DIR_NAME, LESSONS_DIR_NAME } from './contentFs.js';
import { digestUtf8, loadContentSnapshot, type ContentSnapshot } from './generation.js';
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
  /** Catalogues can reuse the exact bundled revision without rereading its disk copy. */
  preferBundledRevision?: boolean;
}

export async function loadLesson(fs: ContentFs, id: string, options?: LoadLessonOptions): Promise<Lesson | null> {
  const snapshot = options?.snapshot ?? await loadContentSnapshot(fs);
  if (options?.preferBundledRevision) {
    const expected = snapshot.manifest?.lessons.find((entry) => entry.id === id);
    if (expected && bundledManifest.lessons.find((entry) => entry.id === id)?.sha256 === expected.sha256) {
      return getBundledLesson(id);
    }
  }
  const fromSnapshot = await readVerifiedLesson(fs, snapshot.root, id, snapshot.manifest);
  if (fromSnapshot) return fromSnapshot;
  const entry = snapshot.manifest?.lessons.find((lesson) => lesson.id === id);
  const bundledEntry = bundledManifest.lessons.find((lesson) => lesson.id === id);
  // A damaged legacy cache may be repaired from the exact bundled revision,
  // never from a different generation masquerading as current content.
  if (entry && bundledEntry?.sha256 === entry.sha256) return getBundledLesson(id);
  if (!snapshot.manifest && !options?.snapshot && options?.bundledFallback) return getBundledLesson(id);
  return null;
}

export async function saveLesson(fs: ContentFs, id: string, lesson: unknown): Promise<void> {
  await fs.ensureDirectory(lessonsDir(fs));
  await fs.writeFile(`${lessonsDir(fs)}${id}.json`, JSON.stringify(lesson));
}

export async function loadLocalManifest(fs: ContentFs): Promise<Manifest | null> {
  return (await loadContentSnapshot(fs)).manifest;
}

export async function saveLocalManifest(fs: ContentFs, manifest: Manifest): Promise<void> {
  await fs.ensureDirectory(contentDir(fs));
  await fs.writeFile(`${contentDir(fs)}manifest.json`, JSON.stringify(manifest));
}

export async function loadModules(fs: ContentFs): Promise<ModulesFile | null> {
  return (await loadContentSnapshot(fs)).modules;
}

/** Manifest der gebuendelten Erststart-Fassung (Offline-Fallback fuer Profil/IDs). */
export function bundledFallbackManifest(): Manifest {
  return bundledManifest;
}
