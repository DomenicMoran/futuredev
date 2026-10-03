import type { ContentFs } from './types.js';
import { CONTENT_DIR_NAME, LESSONS_DIR_NAME } from './contentFs.js';
import type { Manifest, ModulesFile } from '@futuredev/content-schema';
import { commitContentGeneration, loadContentSnapshot } from './generation.js';

export interface BundledContent {
  manifest: Manifest;
  modules: ModulesFile;
  lessons: Record<string, unknown>;
  rawManifest?: string;
  rawModules?: string;
  rawLessons?: Record<string, string>;
}

/**
 * Kopiert die gebuendelte Erststart-Fassung (aus
 * `assets/content/bundled.generated.ts`, erzeugt von
 * `scripts/bundle-content.mjs`) ins Dokumentverzeichnis, aber nur, wenn dort
 * noch kein Manifest liegt. Ein spaeteres, frisch geladenes Manifest wird nie
 * ueberschrieben (Technikvorgabe 4).
 */
export async function ensureBundledContent(fs: ContentFs, bundled: BundledContent): Promise<boolean> {
  if (bundled.rawManifest && bundled.rawModules && bundled.rawLessons) {
    const current = await loadContentSnapshot(fs);
    if (current.manifest) {
      const previous = current.manifest.version.split('.').map(Number);
      const next = bundled.manifest.version.split('.').map(Number);
      const difference = next.map((value, i) => value - (previous[i] ?? 0)).find((value) => value !== 0) ?? 0;
      if (difference < 0 || (difference === 0 && current.generationId && !current.recoveryRequired)) return false;
    }
    await commitContentGeneration(fs, {
      manifest: bundled.manifest,
      rawManifest: bundled.rawManifest,
      rawModules: bundled.rawModules,
      rawLessons: bundled.rawLessons,
    });
    return true;
  }
  const contentDir = `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
  const lessonsDir = `${contentDir}${LESSONS_DIR_NAME}/`;
  const manifestPath = `${contentDir}manifest.json`;

  if (await fs.exists(manifestPath)) {
    return false;
  }

  await fs.ensureDirectory(contentDir);
  await fs.ensureDirectory(lessonsDir);
  await fs.writeFile(`${contentDir}modules.json`, JSON.stringify(bundled.modules));
  for (const entry of bundled.manifest.lessons) {
    const lesson = bundled.lessons[entry.id];
    if (lesson) {
      await fs.writeFile(`${lessonsDir}${entry.id}.json`, JSON.stringify(lesson));
    }
  }
  // Manifest zuletzt schreiben: erst wenn es da ist, gilt der Erststart als abgeschlossen.
  await fs.writeFile(manifestPath, JSON.stringify(bundled.manifest));
  return true;
}
