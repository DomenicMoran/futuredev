import type { ContentState } from './types.js';
import { getContentFs } from './contentFs.js';
import { fetchManifest } from './fetchManifest.js';
import { diffManifests } from './manifestDiff.js';
import { loadLocalManifest, loadModules, saveLesson, saveLocalManifest } from './lessonLoader.js';
import { ensureBundledContent, type BundledContent } from './bundledContent.js';

/**
 * Voller Ladeweg (Technikvorgabe 4): Erststart-Kopie sicherstellen, Manifest
 * holen (mit Timeout), geänderte Lektionen nachladen, neues Manifest
 * schreiben. Fehler (kein Netz, Timeout, ungueltig) werden als Zustand
 * gemeldet statt als Absturz; der zuletzt bekannte lokale Stand bleibt in
 * jedem Fall nutzbar.
 */
export async function refreshContent(bundled: BundledContent): Promise<ContentState> {
  const fs = await getContentFs();
  await ensureBundledContent(fs, bundled);

  const localManifestBefore = await loadLocalManifest(fs);
  // Basis-URL kommt aus dem Manifest selbst (lokal, sonst gebuendelt), nicht
  // aus einer im Code fest verdrahteten Vermutung: eine geaenderte
  // `contentBaseUrl` in einer neuen Manifest-Fassung greift so automatisch,
  // ohne dass dieses Modul angefasst werden muss. `EXPO_PUBLIC_...` erlaubt
  // trotzdem eine Override fuer lokale Entwicklung/Tests.
  const contentBaseUrl =
    process.env.EXPO_PUBLIC_CONTENT_BASE_URL ??
    localManifestBefore?.contentBaseUrl ??
    bundled.manifest.contentBaseUrl;
  const result = await fetchManifest(contentBaseUrl);

  if (result.status !== 'ok') {
    const modules = await loadModules(fs);
    return {
      status: localManifestBefore ? 'offline' : 'error',
      manifest: localManifestBefore,
      modules,
      lastUpdatedAt: localManifestBefore?.version ? new Date().toISOString() : null,
      hasNewLessons: false,
      message: result.message,
    };
  }

  const changedLessons = diffManifests(localManifestBefore, result.manifest);
  for (const entry of changedLessons) {
    const lessonResult = await fetchLessonFile(entry, result.manifest.contentBaseUrl);
    if (lessonResult) {
      await saveLesson(fs, entry.id, lessonResult);
    }
  }
  await saveLocalManifest(fs, result.manifest);
  const modules = await loadModules(fs);

  return {
    status: 'ok',
    manifest: result.manifest,
    modules,
    lastUpdatedAt: new Date().toISOString(),
    hasNewLessons: changedLessons.length > 0,
  };
}

async function fetchLessonFile(
  entry: { id: string; file: string },
  contentBaseUrl: string,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${contentBaseUrl.replace(/\/$/, '')}/${entry.file}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
