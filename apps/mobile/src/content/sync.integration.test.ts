import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundledContent, bundledLessonRaw, bundledManifest, bundledModulesRaw } from './bundledData.js';
import { setContentFs } from './contentFs.js';
import { ensureBundledContent } from './bundledContent.js';
import { digestUtf8, loadContentSnapshot } from './generation.js';
import { loadLesson, loadLocalManifest, loadModules } from './lessonLoader.js';
import { refreshContent } from './sync.js';
import type { ContentFs } from './types.js';
import { loadFlashcardDeck } from '../flashcards/deck.js';
import { resetToMemoryDatabase } from '../data/db.js';

let sequence = 0;
function memoryFs() {
  const files = new Map<string, string>();
  const fs: ContentFs = {
    documentDirectory: `file:///sync-${++sequence}/`,
    async ensureDirectory() { /* Directories are implicit in this in-memory filesystem. */ },
    async writeFile(path, raw) { files.set(path, raw); },
    async readFile(path) { const raw = files.get(path); if (raw === undefined) throw new Error('missing'); return raw; },
    async exists(path) { return files.has(path); },
    async listDirectory(path) { return [...new Set([...files.keys()].filter((key) => key.startsWith(path)).map((key) => key.slice(path.length).split('/')[0] ?? '').filter(Boolean))]; },
    async moveFile(from, to) { const raw = files.get(from); if (raw === undefined) throw new Error('missing'); files.set(to, raw); files.delete(from); },
    async getFileSize(path) { return files.get(path)?.length ?? null; },
    async readFilePrefixBase64() { return ''; },
  };
  setContentFs(fs);
  return { fs, files };
}

afterEach(() => vi.unstubAllGlobals());

describe('real bundled content through the production boot and update path', () => {
  it('keeps exact bytes and makes every bundled lesson readable offline after first boot', async () => {
    const { fs } = memoryFs();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const state = await refreshContent(bundledContent);
    expect(state.status).toBe('offline');
    const snapshot = await loadContentSnapshot(fs);
    expect(snapshot.generationId).not.toBeNull();
    for (const entry of bundledManifest.lessons) {
      expect(digestUtf8(await fs.readFile(`${snapshot.root}lessons/${entry.file}`))).toBe(entry.sha256);
      expect((await loadLesson(fs, entry.id, { snapshot }))?.id).toBe(entry.id);
    }
    expect((await loadModules(fs))?.modules).toHaveLength(10);
  });

  it('repairs the 0.1.22 flat cache with its reserialized, checksum-invalid lessons', async () => {
    const { fs, files } = memoryFs();
    const root = `${fs.documentDirectory}content/`;
    files.set(`${root}manifest.json`, JSON.stringify(bundledManifest));
    files.set(`${root}modules.json`, JSON.stringify(bundledContent.modules));
    for (const [id, lesson] of Object.entries(bundledContent.lessons)) files.set(`${root}lessons/${id}.json`, JSON.stringify(lesson));
    expect(await ensureBundledContent(fs, bundledContent)).toBe(true);
    expect((await loadContentSnapshot(fs)).generationId).not.toBeNull();
    expect((await loadLesson(fs, 'M01-01-01'))?.id).toBe('M01-01-01');
    expect(await ensureBundledContent(fs, bundledContent)).toBe(false);
  });

  it('pins the complete flashcard deck to one snapshot instead of rereading 197 generations', async () => {
    const { fs } = memoryFs();
    resetToMemoryDatabase();
    await ensureBundledContent(fs, bundledContent);
    let reads = 0;
    const read = fs.readFile;
    fs.readFile = async (path) => { if (path.includes('/lessons/')) reads += 1; return read(path); };
    expect((await loadFlashcardDeck()).length).toBeGreaterThan(100);
    expect(reads).toBe(bundledManifest.lessons.length * 2);
    reads = 0;
    await loadContentSnapshot(fs);
    await loadContentSnapshot(fs);
    expect(reads).toBe(0);
    const snapshot = await loadContentSnapshot(fs);
    for (const entry of bundledManifest.lessons) {
      expect((await loadLesson(fs, entry.id, { snapshot, preferBundledRevision: true }))?.id).toBe(entry.id);
    }
    expect(reads).toBe(0);
  });

  it.each(['404', 'checksum'])('does not publish a partial update after a %s failure, and retries successfully', async (failure) => {
    const { fs } = memoryFs();
    await ensureBundledContent(fs, bundledContent);
    const before = await loadContentSnapshot(fs);
    const first = bundledManifest.lessons[0];
    if (!first) throw new Error('Missing bundled test fixture');
    const id = first.id;
    const originalRaw = bundledLessonRaw[id];
    if (!originalRaw) throw new Error('Missing bundled lesson fixture');
    const lesson = JSON.parse(originalRaw);
    lesson.title = 'Geprüftes neues Lernziel';
    const raw = JSON.stringify(lesson);
    const next = { ...bundledManifest, version: '0.6.3', lessons: bundledManifest.lessons.map((entry) => entry.id === id ? { ...entry, sha256: digestUtf8(raw) } : entry) };
    let fail = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/manifest.json')) return new Response(JSON.stringify(next));
      if (url.endsWith('/modules.json')) return new Response(bundledModulesRaw);
      if (url.endsWith(`/lessons/${id}.json`)) return fail ? new Response('invalid', { status: failure === '404' ? 404 : 200 }) : new Response(raw);
      throw new Error(`Unexpected download ${url}`);
    }));
    expect((await refreshContent(bundledContent)).status).toBe('offline');
    expect((await loadContentSnapshot(fs)).generationId).toBe(before.generationId);
    expect((await loadLesson(fs, id))?.title).not.toBe(lesson.title);
    fail = false;
    expect((await refreshContent(bundledContent)).status).toBe('ok');
    expect((await loadLocalManifest(fs))?.version).toBe('0.6.3');
    expect((await loadLesson(fs, id))?.title).toBe(lesson.title);
    const active = await loadContentSnapshot(fs);
    await fs.writeFile(`${active.root}lessons/${id}.json`, raw.replace(lesson.title, 'Ungeprüfte Änderung'));
    // Warm generation metadata never bypasses the individual lesson checksum.
    expect(await loadLesson(fs, id)).toBeNull();
  });
});
