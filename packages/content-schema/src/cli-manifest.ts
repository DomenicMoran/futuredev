#!/usr/bin/env tsx
// Builds a complete manifest from the exact UTF-8 bytes of modules and every
// lesson. `--qa-output <dir>` writes a disposable snapshot only and never
// touches content/manifest.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, compareSemver, type ManifestSourceLesson } from './manifest-generation.js';
import { MissingBaseUrlError, resolveManifestBaseUrls, type ManifestConfig } from './manifest-base-url.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contentDir = join(repoRoot, 'content');
const lessonsDir = join(contentDir, 'lessons');
const manifestPath = join(contentDir, 'manifest.json');
const modulesPath = join(contentDir, 'modules.json');
const manifestConfigPath = join(contentDir, 'manifest.config.json');

function updatedAtFor(path: string): string {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', path], { cwd: repoRoot, encoding: 'utf8' }).trim();
    if (out) return out;
  } catch { /* first uncommitted generation uses filesystem time */ }
  return new Date(statSync(path).mtime).toISOString();
}

function atomicWrite(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, value, 'utf8');
  renameSync(temp, path);
}

function writeSnapshotAtomically(target: string, rawManifest: string, rawModules: Uint8Array, sources: readonly ManifestSourceLesson[]): void {
  const stage = `${target}.stage-${process.pid}`;
  const backup = `${target}.previous-${process.pid}`;
  if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'lessons'), { recursive: true });
  try {
    writeFileSync(join(stage, 'modules.json'), rawModules);
    for (const source of sources) writeFileSync(join(stage, 'lessons', source.file), source.bytes);
    atomicWrite(join(stage, 'manifest.json'), rawManifest);
    if (existsSync(target)) renameSync(target, backup);
    try { renameSync(stage, target); }
    catch (error) {
      if (existsSync(backup) && !existsSync(target)) renameSync(backup, target);
      throw error;
    }
  } catch (error) {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function main(): void {
  const qaArg = process.argv.indexOf('--qa-output');
  const qaOutput = qaArg >= 0 ? process.argv[qaArg + 1] : undefined;
  if (qaArg >= 0 && !qaOutput) throw new Error('--qa-output requires a target folder');
  const config = JSON.parse(readFileSync(manifestConfigPath, 'utf8')) as ManifestConfig;
  const bases = resolveManifestBaseUrls(process.env, config);
  const version = process.env.CONTENT_VERSION ?? '0.6.0';
  const rawModules = readFileSync(modulesPath);
  const sources: ManifestSourceLesson[] = readdirSync(lessonsDir).filter((file) => file.endsWith('.json')).sort().map((file) => {
    const path = join(lessonsDir, file);
    return { file, bytes: readFileSync(path), updatedAt: updatedAtFor(path) };
  });
  const manifest = buildManifest({ version, contentBaseUrl: bases.contentBaseUrl, audioBaseUrl: bases.audioBaseUrl, rawModules, lessons: sources });
  const current = (() => { try { return JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string; modulesSha256?: string; lessons?: { id: string; sha256: string }[] }; } catch { return null; } })();
  if (current?.version) {
    if (compareSemver(version, current.version) < 0) throw new Error(`Refusing manifest downgrade ${current.version} → ${version}`);
    if (compareSemver(version, current.version) === 0) {
      const identity = (rows: readonly { id: string; sha256: string }[] = []) => rows.map(({ id, sha256 }) => `${id}:${sha256}`).sort().join('|');
      const same = current.modulesSha256 === manifest.modulesSha256 && identity(current.lessons) === identity(manifest.lessons);
      if (!same) throw new Error(`Content changed without a version increase from ${current.version}`);
    }
  }
  const rawManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  if (qaOutput) {
    const target = resolve(repoRoot, qaOutput);
    const qaRoot = `${resolve(repoRoot, 'tmp-qa')}${sep}`;
    if (!target.startsWith(qaRoot)) throw new Error('--qa-output is restricted to repository tmp-qa paths');
    writeSnapshotAtomically(target, rawManifest, rawModules, sources);
    console.log(`content:manifest: QA snapshot ${manifest.version}, ${sources.length} lessons at ${target}; repository manifest unchanged.`);
    return;
  }
  atomicWrite(manifestPath, rawManifest);
  console.log(`content:manifest: full generation ${manifest.version}, ${sources.length} lessons with module and raw-byte SHA-256 written atomically.`);
}

try {
  main();
} catch (error) {
  const message = error instanceof MissingBaseUrlError ? error.message : error instanceof Error ? error.message : String(error);
  console.error(`content:manifest: ${message}`);
  process.exitCode = 1;
}
