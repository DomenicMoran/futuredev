import { describe, expect, it } from 'vitest';
import {
  bundledLessonRaw,
  bundledManifest,
  bundledModulesRaw,
} from '../content/bundledData.js';
import { commitContentGeneration, digestUtf8, loadContentSnapshot } from '../content/generation.js';
import type { ContentFs } from '../content/types.js';
import { loadLessonSearchIndex } from './lessonSearchIndex.js';

function createCountedFs() {
  const files = new Map<string, string>();
  const counts = { lessonReads: 0 };
  const fs: ContentFs = {
    documentDirectory: 'file:///search-index-tests/',
    async ensureDirectory() { return Promise.resolve(); },
    async writeFile(path, value) { files.set(path, value); },
    async moveFile(from, to) { const value = files.get(from); if (value === undefined) throw new Error('missing source'); files.set(to, value); files.delete(from); },
    async getFileSize(path) { return files.get(path)?.length ?? null; },
    async readFilePrefixBase64() { return ''; },
    async readFile(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error(`missing ${path}`);
      if (path.includes('/lessons/')) counts.lessonReads += 1;
      return value;
    },
    async exists(path) { return files.has(path); },
    async listDirectory(path) {
      const names = [...new Set([...files.keys()].filter((key) => key.startsWith(path)).map((key) => key.slice(path.length).split('/')[0]))];
      return names.filter((name): name is string => Boolean(name));
    },
  };
  return { fs, files, counts };
}

function makeGeneration(version: string, titlePrefix: string) {
  const rawLessons = Object.fromEntries(bundledManifest.lessons.map((entry) => {
    const raw = bundledLessonRaw[entry.id];
    if (raw === undefined) throw new Error(`missing fixture lesson ${entry.id}`);
    const lesson = JSON.parse(raw);
    lesson.title = `${titlePrefix} ${entry.id}`;
    return [entry.id, JSON.stringify(lesson)];
  }));
  const manifest = {
    ...bundledManifest,
    version,
    lessons: bundledManifest.lessons.map((entry) => {
      const raw = rawLessons[entry.id];
      if (raw === undefined) throw new Error(`missing generated lesson ${entry.id}`);
      return { ...entry, sha256: digestUtf8(raw) };
    }),
  };
  return {
    manifest,
    rawManifest: JSON.stringify(manifest),
    rawModules: bundledModulesRaw,
    rawLessons,
  };
}

function bundledCommitPayload() {
  return {
    manifest: bundledManifest,
    rawManifest: JSON.stringify(bundledManifest),
    rawModules: bundledModulesRaw,
    rawLessons: bundledLessonRaw,
  };
}

describe('lesson search index generation binding and read complexity', () => {
  it('validates one snapshot and reuses exact bundled revisions without additional catalogue reads', async () => {
    const { fs, counts } = createCountedFs();
    await commitContentGeneration(fs, bundledCommitPayload());
    counts.lessonReads = 0;

    const result = await loadLessonSearchIndex(fs);
    const lessonCount = bundledManifest.lessons.length;

    expect(result.entries).toHaveLength(lessonCount);
    expect(counts.lessonReads).toBe(lessonCount);
    expect(counts.lessonReads).toBeLessThan(lessonCount * (lessonCount + 1));
  });

  it('keeps every indexed lesson on the snapshot chosen before a pointer switch', async () => {
    const { fs } = createCountedFs();
    const first = makeGeneration('0.5.99', 'A');
    const second = makeGeneration('0.6.0', 'B');
    await commitContentGeneration(fs, first);

    const readFile = fs.readFile.bind(fs);
    const readsByPath = new Map<string, number>();
    let switched = false;
    fs.readFile = async (path) => {
      const raw = await readFile(path);
      if (path.includes('/lessons/')) {
        const reads = (readsByPath.get(path) ?? 0) + 1;
        readsByPath.set(path, reads);
        if (!switched && reads === 2) {
          switched = true;
          await commitContentGeneration(fs, second);
        }
      }
      return raw;
    };

    const result = await loadLessonSearchIndex(fs);

    expect(switched).toBe(true);
    expect(result.snapshot.manifest?.version).toBe('0.5.99');
    expect(result.entries).toHaveLength(first.manifest.lessons.length);
    expect(result.entries.every((entry) => entry.title.startsWith('A '))).toBe(true);
    expect((await loadContentSnapshot(fs)).manifest?.version).toBe('0.6.0');
  });
});
