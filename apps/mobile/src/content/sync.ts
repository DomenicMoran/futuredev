import type { ContentState } from './types.js';
import { getContentFs } from './contentFs.js';
import { fetchManifest } from './fetchManifest.js';
import { ensureBundledContent, type BundledContent } from './bundledContent.js';
import { commitContentGeneration, digestUtf8, loadContentSnapshot, type ContentSnapshot } from './generation.js';
import { fetchVerifiedFile } from './verifiedFile.js';

let refreshing: Promise<ContentState> | null = null;

/** Publish only complete verified generations; coalesce concurrent refreshes. */
export function refreshContent(bundled: BundledContent): Promise<ContentState> {
  if (refreshing) return refreshing;
  const pending = refreshOnce(bundled).finally(() => {
    if (refreshing === pending) refreshing = null;
  });
  refreshing = pending;
  return pending;
}

async function refreshOnce(bundled: BundledContent): Promise<ContentState> {
  let snapshot: ContentSnapshot | null = null;
  try {
    const fs = await getContentFs();
    await ensureBundledContent(fs, bundled);
    snapshot = await loadContentSnapshot(fs);
    const base = process.env.EXPO_PUBLIC_CONTENT_BASE_URL ?? snapshot.manifest?.contentBaseUrl ?? bundled.manifest.contentBaseUrl;
    const result = await fetchManifest(base);
    if (result.status !== 'ok') throw new Error(result.message);
    const remote = result.manifest;
    if (JSON.stringify(remote) === JSON.stringify(snapshot.manifest)) {
      return { status: 'ok', manifest: snapshot.manifest, modules: snapshot.modules, lastUpdatedAt: new Date().toISOString(), hasNewLessons: false };
    }
    if (!remote.modulesSha256) throw new Error('Das Inhaltsupdate enthält keine Modulprüfsumme.');
    const root = remote.contentBaseUrl.replace(/\/$/, '');
    const rawModules = await fetchVerifiedFile(`${root}/modules.json`, remote.modulesSha256);
    const rawLessons: Record<string, string> = {};
    for (const entry of remote.lessons) {
      if (entry.file !== `${entry.id}.json`) throw new Error('Ungültiger Lektionspfad im Inhaltsupdate.');
      const old = snapshot.manifest?.lessons.find((item) => item.id === entry.id);
      if (old?.sha256 === entry.sha256) {
        try {
          const raw = await fs.readFile(`${snapshot.root}lessons/${entry.file}`);
          if (digestUtf8(raw) === entry.sha256) rawLessons[entry.id] = raw;
        } catch { /* Fetch and verify missing or corrupt local bytes. */ }
      }
      rawLessons[entry.id] ??= await fetchVerifiedFile(`${root}/lessons/${entry.file}`, entry.sha256);
    }
    const generation = await commitContentGeneration(fs, { manifest: remote, rawManifest: JSON.stringify(remote), rawModules, rawLessons });
    return { status: 'ok', manifest: generation.manifest, modules: generation.modules, lastUpdatedAt: new Date().toISOString(), hasNewLessons: true };
  } catch (error) {
    return {
      status: snapshot?.manifest ? 'offline' : 'error',
      manifest: snapshot?.manifest ?? bundled.manifest,
      modules: snapshot?.modules ?? bundled.modules,
      lastUpdatedAt: null,
      hasNewLessons: false,
      message: error instanceof Error ? error.message : 'Inhalte konnten nicht aktualisiert werden.',
    };
  }
}
