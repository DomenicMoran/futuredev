import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { afterEach, describe, expect, it } from 'vitest';
import { atomicWriteFile } from './bundle-content-core.mjs';
import { createBundledAccessors } from '../src/content/bundledData.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let tempDir;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('content bundle atomic writer', () => {
  it('replaces a complete existing runtime module without truncating it first', () => {
    tempDir = mkdtempSync(path.join(repoRoot, 'tmp-qa', 'bundle-atomic-'));
    const target = path.join(tempDir, 'bundled.generated.ts');
    writeFileSync(target, 'export const old = true;\n', 'utf8');
    const next = Buffer.from('export const next = "完整 😀";\n', 'utf8');
    atomicWriteFile(target, next);
    expect(readFileSync(target)).toEqual(next);
  });

  it('runs the real QA bundler and feeds its generated raw exports into the actual bundled accessors', async () => {
    tempDir = mkdtempSync(path.join(repoRoot, 'tmp-qa', 'bundle-consumer-'));
    const input = path.join(tempDir, 'input');
    const output = path.join(tempDir, 'output');
    mkdirSync(path.join(input, 'lessons'), { recursive: true });
    const moduleData = { modules: Array.from({ length: 10 }, (_, index) => {
      const id = `M${String(index + 1).padStart(2, '0')}`;
      return { id, title: `Modul ${id}`, subModules: [{ id: `${id}-01`, title: 'Abschnitt' }] };
    }) };
    const lesson = {
      id: 'M01-01-01', title: 'QA generated lesson 😀', durationMinutes: 10, prerequisites: [], terms: [],
      speechBlocks: [{ speaker: 'A', text: 'Ein Satz.', isKeySentence: true, role: 'key' }],
      practiceExample: { text: 'Beispiel', repoNote: 'repo-cron-last-due', location: 'Funktion' },
      quiz: Array.from({ length: 10 }, (_, index) => ({ questionId: `q_00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, question: `Frage ${index}?`, area: 'M01-01', options: [0, 1, 2, 3].map((option) => ({ text: `Option ${option}`, isCorrect: option === 0, explanation: 'Erklärung' })) })),
      practiceTask: { task: 'Aufgabe', expectation: 'Ergebnis', checklist: ['Prüfen'] },
      audio: { file: 'M01-01-01.mp3', durationSeconds: 90, voices: ['A'], aiGenerated: true },
      faq: Array.from({ length: 5 }, (_, index) => ({ question: `Frage ${index}?`, answer: 'Das ist Antwort eins. Das ist Antwort zwei.' })),
    };
    const rawModules = `${JSON.stringify(moduleData, null, 2)}\n`;
    const rawLesson = `${JSON.stringify(lesson, null, 2)}\n`;
    const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
    writeFileSync(path.join(input, 'modules.json'), rawModules, 'utf8');
    writeFileSync(path.join(input, 'lessons', `${lesson.id}.json`), rawLesson, 'utf8');
    const manifest = {
      version: '0.6.1', contentBaseUrl: 'https://example.test/content', audioBaseUrl: 'https://example.test/audio',
      modulesSha256: sha(rawModules),
      lessons: [{ id: lesson.id, file: `${lesson.id}.json`, sha256: sha(rawLesson), updatedAt: '2026-09-25T00:00:00Z' }],
    };
    writeFileSync(path.join(input, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const relative = (value) => path.relative(repoRoot, value).split(path.sep).join('/');
    const run = spawnSync(process.execPath, [path.join(repoRoot, 'apps/mobile/scripts/bundle-content.mjs'), '--qa-input', relative(input), '--output', relative(output)], { cwd: repoRoot, encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);

    const generated = await tsImport(pathToFileURL(path.join(output, 'bundled.generated.ts')).href, import.meta.url);
    const generatedExports = generated.default ?? generated;
    expect(Object.keys(generatedExports)).toEqual(expect.arrayContaining(['bundledManifestRaw', 'bundledModulesRaw', 'bundledLessonRaw']));
    const consumer = createBundledAccessors(generatedExports);
    expect(consumer.manifest.version).toBe('0.6.1');
    expect(consumer.modules.modules).toHaveLength(10);
    expect(consumer.lesson(lesson.id)?.title).toBe(lesson.title);
  });
});
