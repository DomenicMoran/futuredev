#!/usr/bin/env node
// Verifies and atomically stages a complete v0.6+ content generation for Metro.
// `--qa-input <snapshot>` plus `--output <tmp-qa/...>` never writes source content.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { atomicWriteFile, buildBundledContentModule } from './bundle-content-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const repoRoot = path.resolve(mobileRoot, '../..');
const schemaSrc = path.join(repoRoot, 'packages', 'content-schema', 'src');
const [lessonSchemaModule, manifestSchemaModule, modulesSchemaModule] = await Promise.all([
  tsImport(pathToFileURL(path.join(schemaSrc, 'lesson.ts')).href, import.meta.url),
  tsImport(pathToFileURL(path.join(schemaSrc, 'manifest.ts')).href, import.meta.url),
  tsImport(pathToFileURL(path.join(schemaSrc, 'modules.ts')).href, import.meta.url),
]);
const args = process.argv.slice(2);
function arg(name) { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] ?? null; }
const qaInput = arg('--qa-input');
const customOutput = arg('--output');
const sourceDir = qaInput ? path.resolve(repoRoot, qaInput) : path.join(repoRoot, 'content');
const outputDir = customOutput ? path.resolve(repoRoot, customOutput) : path.join(mobileRoot, 'assets', 'content');
if (customOutput && !outputDir.startsWith(path.join(repoRoot, 'tmp-qa') + path.sep)) {
  throw new Error('--output is restricted to a repository tmp-qa path');
}
if (qaInput && !sourceDir.startsWith(path.join(repoRoot, 'tmp-qa') + path.sep)) {
  throw new Error('--qa-input is restricted to a repository tmp-qa snapshot');
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function compareVersion(left, right) {
  const a = left.split('.').map(Number); const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) { const difference = (a[i] ?? 0) - (b[i] ?? 0); if (difference) return Math.sign(difference); }
  return 0;
}
function parseJson(bytes, name) {
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (!Buffer.from(raw, 'utf8').equals(Buffer.from(bytes))) throw new Error(`${name} is not byte-stable UTF-8`);
  return { raw, value: JSON.parse(raw) };
}

const manifestPath = path.join(sourceDir, 'manifest.json');
const manifestBytes = readFileSync(manifestPath);
const { raw: manifestRaw, value: manifest } = parseJson(manifestBytes, 'manifest.json');
manifestSchemaModule.manifestSchema.parse(manifest);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || compareVersion(manifest.version, '0.5.0') <= 0) {
  throw new Error(`Bundle generation must be newer than published 0.5.0 (received ${manifest.version})`);
}
if (!/^[a-f0-9]{64}$/.test(manifest.modulesSha256 ?? '')) throw new Error('Manifest requires modulesSha256');
const modulesPath = path.join(sourceDir, 'modules.json');
const modulesBytes = readFileSync(modulesPath);
const { raw: modulesRaw, value: modules } = parseJson(modulesBytes, 'modules.json');
modulesSchemaModule.modulesFileSchema.parse(modules);
if (sha256(modulesBytes) !== manifest.modulesSha256) throw new Error('modules.json SHA-256 mismatch');
if (!Array.isArray(modules.modules) || modules.modules.length !== 10) throw new Error('modules.json must contain the complete ten-module map');
const moduleIds = modules.modules.map((module) => module.id).sort();
if (new Set(moduleIds).size !== 10 || moduleIds.some((id, index) => id !== `M${String(index + 1).padStart(2, '0')}`)) throw new Error('modules.json must contain each module M01 through M10 exactly once');
const submoduleIds = new Set(modules.modules.flatMap((module) => (module.subModules ?? []).map((submodule) => submodule.id)));
if (submoduleIds.size !== modules.modules.reduce((count, module) => count + (module.subModules?.length ?? 0), 0)) throw new Error('modules.json contains duplicate submodule IDs');
for (const module of modules.modules) for (const submodule of module.subModules ?? []) if (!submodule.id.startsWith(`${module.id}-`)) throw new Error(`Submodule ${submodule.id} belongs under the wrong module`);
const lessonsDir = path.join(sourceDir, 'lessons');
const lessonFiles = readdirSync(lessonsDir).filter((file) => file.endsWith('.json')).sort();
if (!Array.isArray(manifest.lessons) || manifest.lessons.length === 0) throw new Error('Manifest cannot be empty');
if (lessonFiles.length !== manifest.lessons.length) throw new Error('Bundle lesson directory and manifest are not the same complete set');
const manifestByFile = new Map();
for (const entry of manifest.lessons) {
  if (entry.file !== `${entry.id}.json` || !/^[A-Za-z0-9-]+\.json$/.test(entry.file)) throw new Error(`Unsafe or mismatched manifest file ${entry.file}`);
  if (manifestByFile.has(entry.file)) throw new Error(`Duplicate lesson manifest file ${entry.file}`);
  manifestByFile.set(entry.file, entry);
}
  const rawLessons = {};
const lessonIds = new Set();
for (const file of lessonFiles) {
  const entry = manifestByFile.get(file);
  if (!entry) throw new Error(`Unlisted lesson file: ${file}`);
  const sourcePath = path.join(lessonsDir, file);
  const bytes = readFileSync(sourcePath);
  if (sha256(bytes) !== entry.sha256) throw new Error(`Raw-byte SHA-256 mismatch for ${file}`);
  const { raw, value: lesson } = parseJson(bytes, file);
  lessonSchemaModule.lessonSchema.parse(lesson);
  if (lesson.id !== entry.id || file !== `${lesson.id}.json`) throw new Error(`Lesson identity mismatch for ${file}`);
  if (lessonIds.has(lesson.id)) throw new Error(`Duplicate lesson ID ${lesson.id}`);
  if (!submoduleIds.has(lesson.id.slice(0, 6))) throw new Error(`modules.json has no submodule for ${lesson.id}`);
  lessonIds.add(lesson.id);
  rawLessons[lesson.id] = raw;
}
for (const entry of manifest.lessons) if (!lessonIds.has(entry.id)) throw new Error(`Missing listed lesson ${entry.id}`);
for (const file of lessonFiles) {
  const { value: lesson } = parseJson(readFileSync(path.join(lessonsDir, file)), file);
  for (const prerequisite of lesson.prerequisites ?? []) if (!lessonIds.has(prerequisite)) throw new Error(`Missing prerequisite ${prerequisite} referenced by ${lesson.id}`);
}

mkdirSync(outputDir, { recursive: true });
const sidecarStage = `${outputDir}.sidecars-${process.pid}`;
if (existsSync(sidecarStage)) rmSync(sidecarStage, { recursive: true, force: true });
mkdirSync(path.join(sidecarStage, 'lessons'), { recursive: true });
try {
  writeFileSync(path.join(sidecarStage, 'manifest.json'), manifestBytes);
  writeFileSync(path.join(sidecarStage, 'modules.json'), modulesBytes);
  for (const file of lessonFiles) writeFileSync(path.join(sidecarStage, 'lessons', file), readFileSync(path.join(lessonsDir, file)));
  const generated = buildBundledContentModule(manifestRaw, modulesRaw, rawLessons);
  // The app consumes only bundled.generated.ts. Stage sidecars first and atomically switch that sole runtime pointer last.
  atomicWriteFile(path.join(outputDir, 'manifest.json'), readFileSync(path.join(sidecarStage, 'manifest.json')));
  atomicWriteFile(path.join(outputDir, 'modules.json'), readFileSync(path.join(sidecarStage, 'modules.json')));
  mkdirSync(path.join(outputDir, 'lessons'), { recursive: true });
  for (const file of lessonFiles) atomicWriteFile(path.join(outputDir, 'lessons', file), readFileSync(path.join(sidecarStage, 'lessons', file)));
  atomicWriteFile(path.join(outputDir, 'bundled.generated.ts'), Buffer.from(generated, 'utf8'));
  console.log(`bundle-content: atomically installed raw-byte module for ${manifest.version}, ${manifest.lessons.length} verified lessons at ${path.relative(repoRoot, outputDir)}${qaInput ? ' (QA-only)' : ''}.`);
} finally {
  if (existsSync(sidecarStage)) rmSync(sidecarStage, { recursive: true, force: true });
}
