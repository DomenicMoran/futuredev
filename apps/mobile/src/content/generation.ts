import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { lessonSchema, manifestSchema, modulesFileSchema, type Lesson, type Manifest, type ModulesFile } from '@futuredev/content-schema';
import type { ContentFs } from './types.js';
import { CONTENT_DIR_NAME, LESSONS_DIR_NAME } from './contentFs.js';

export const ACTIVE_GENERATION_FILE = 'active-generation.json';
export const ACTIVE_GENERATION_PREFIX = 'active-generation.';
export const GENERATIONS_DIR = 'generations';
const SEQUENCED_POINTER = /^active-generation\.(\d{10})\.json$/;
const generationWriteTails = new Map<string, Promise<void>>();
const inFlightContentSnapshots = new Map<string, Promise<ContentSnapshot>>();
// Generation directories are immutable after publication. Verify the full package
// once per process, then keep checking manifest/modules and each requested lesson.
// Rechecking all 197 payloads on every tab change blocks Hermes for many seconds.
const verifiedGenerations = new WeakMap<ContentFs, Set<string>>();

function contentFsKey(fs: ContentFs): string {
  return fs.documentDirectory.replace(/[/\\]+$/, '');
}

export interface ContentSnapshot {
  root: string;
  manifest: Manifest | null;
  modules: ModulesFile | null;
  pointerSequence: number | null;
  generationId: string | null;
  /** A complete generation was recovered without trusting any surviving pointer. */
  recoveredFromGeneration?: boolean;
  /** Pointer damage was observed and a fresh pointer should be published on activation. */
  recoveryRequired?: boolean;
}
export interface ValidatedGeneration {
  manifest: Manifest;
  modules: ModulesFile;
  lessons: Record<string, Lesson>;
  generationId: string;
  manifestSha256: string;
}

export function digestUtf8(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)));
}

export function validateGenerationPayload(input: {
  manifest: unknown;
  rawModules: string;
  rawLessons: Record<string, string>;
}): ValidatedGeneration {
  const manifest = manifestSchema.parse(input.manifest);
  if (!manifest.modulesSha256) throw new Error('Manifest lacks modulesSha256; refusing incomplete generation');
  if (digestUtf8(input.rawModules) !== manifest.modulesSha256) throw new Error('modules.json SHA-256 mismatch');
  const modules = modulesFileSchema.parse(JSON.parse(input.rawModules)) as ModulesFile;
  const expectedModules = Array.from({ length: 10 }, (_, index) => `M${String(index + 1).padStart(2, '0')}`);
  const actualModules = modules.modules.map((module) => module.id).sort();
  if (new Set(actualModules).size !== 10 || actualModules.some((id, index) => id !== expectedModules[index])) throw new Error('Incomplete or duplicate module map');
  const moduleSubmodules = new Map(modules.modules.map((module) => [module.id, new Set(module.subModules.map((sub) => sub.id))]));
  const ids = new Set(manifest.lessons.map((entry) => entry.id));
  if (Object.keys(input.rawLessons).length !== ids.size) throw new Error('Generation lesson payload is incomplete or contains extra files');
  const lessons: Record<string, Lesson> = {};
  for (const entry of manifest.lessons) {
    const raw = input.rawLessons[entry.id];
    if (raw === undefined) throw new Error(`Missing lesson payload ${entry.id}`);
    if (digestUtf8(raw) !== entry.sha256) throw new Error(`Lesson SHA-256 mismatch: ${entry.id}`);
    const lesson = lessonSchema.parse(JSON.parse(raw));
    if (lesson.id !== entry.id || entry.file !== `${lesson.id}.json`) throw new Error(`Lesson identity mismatch: ${entry.id}`);
    const submodules = moduleSubmodules.get(lesson.id.slice(0, 3));
    if (!submodules?.has(lesson.id.slice(0, 6))) throw new Error(`Modules file does not reference ${lesson.id}`);
    lessons[lesson.id] = lesson;
  }
  for (const lesson of Object.values(lessons)) {
    for (const prerequisite of lesson.prerequisites) {
      if (!ids.has(prerequisite)) throw new Error(`Missing prerequisite ${prerequisite} referenced by ${lesson.id}`);
    }
  }
  const manifestSha256 = digestUtf8(JSON.stringify(manifest));
  const generationId = `v${manifest.version.replaceAll('.', '_')}-${manifestSha256.slice(0, 16)}`;
  return { manifest, modules, lessons, generationId, manifestSha256 };
}

export async function loadContentSnapshot(fs: ContentFs): Promise<ContentSnapshot> {
  const key = contentFsKey(fs);
  const inFlight = inFlightContentSnapshots.get(key);
  if (inFlight) return inFlight;
  const load = loadContentSnapshotOnce(fs).finally(() => {
    if (inFlightContentSnapshots.get(key) === load) inFlightContentSnapshots.delete(key);
  });
  inFlightContentSnapshots.set(key, load);
  return load;
}

async function loadContentSnapshotOnce(fs: ContentFs): Promise<ContentSnapshot> {
  const base = `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
  const entries = await fs.listDirectory(base);
  const sequenced = entries.map((entry) => pathName(entry)).flatMap((name) => {
    const match = SEQUENCED_POINTER.exec(name);
    return match ? [{ name, sequence: Number(match[1]) }] : [];
  }).sort((left, right) => right.sequence - left.sequence);
  let sawPointer = sequenced.length > 0;
  for (const pointer of sequenced) {
    try {
      const snapshot = await snapshotFromPointer(fs, base, `${base}${pointer.name}`, pointer.sequence);
      if (snapshot) return snapshot;
    } catch { /* A corrupt newest pointer falls back only to an older validated generation. */ }
  }
  const legacyPointer = `${base}${ACTIVE_GENERATION_FILE}`;
  if (await fs.exists(legacyPointer)) {
    sawPointer = true;
    try {
      const snapshot = await snapshotFromPointer(fs, base, legacyPointer, null);
      if (snapshot) return snapshot;
    } catch { /* Fail closed below; never silently switch to the unrelated flat cache. */ }
  }
  if (sawPointer) {
    let recovered: ContentSnapshot | null = null;
    try { recovered = await recoverRetainedGeneration(fs, base, sequenced); } catch { /* bundle remains a safe repair source */ }
    if (recovered) return recovered;
    return {
      root: base, manifest: null, modules: null,
      pointerSequence: Math.max(0, ...sequenced.map((pointer) => pointer.sequence)),
      generationId: null, recoveryRequired: true,
    };
  }
  return readFlatSnapshot(fs, base);
}

export async function getActiveContentRoot(fs: ContentFs): Promise<string> {
  return (await loadContentSnapshot(fs)).root;
}

function pathName(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? path;
}

async function snapshotFromPointer(fs: ContentFs, base: string, pointerPath: string, sequence: number | null): Promise<ContentSnapshot | null> {
  if (!(await fs.exists(pointerPath))) return null;
  const value: unknown = JSON.parse(await fs.readFile(pointerPath));
  if (!value || typeof value !== 'object' || !('generation' in value) || typeof value.generation !== 'string') throw new Error('Active pointer malformed');
  const pointer = value as { generation: string; version?: string; manifestSha256?: string };
  if (!/^v\d+_\d+_\d+-[a-f0-9]{16}$/.test(pointer.generation)) throw new Error('Active pointer generation is unsafe');
  const snapshot = await snapshotFromGeneration(fs, base, pointer.generation, sequence);
  if (!snapshot) return null;
  if (typeof pointer.version === 'string' && pointer.version !== snapshot.manifest?.version) throw new Error('Pointer version differs from generation manifest');
  if (typeof pointer.manifestSha256 === 'string' && pointer.manifestSha256 !== digestUtf8(JSON.stringify(snapshot.manifest))) throw new Error('Pointer manifest checksum mismatch');
  return snapshot;
}

async function snapshotFromGeneration(fs: ContentFs, base: string, generation: string, sequence: number | null): Promise<ContentSnapshot | null> {
  if (!/^v\d+_\d+_\d+-[a-f0-9]{16}$/.test(generation)) return null;
  const root = `${base}${GENERATIONS_DIR}/${generation}/`;
  const manifestPath = `${root}manifest.json`;
  const modulesPath = `${root}modules.json`;
  if (!(await fs.exists(manifestPath)) || !(await fs.exists(modulesPath))) return null;
  const rawManifest = await fs.readFile(manifestPath);
  const manifest = manifestSchema.parse(JSON.parse(rawManifest));
  const expectedGenerationId = `v${manifest.version.replaceAll('.', '_')}-${digestUtf8(JSON.stringify(manifest)).slice(0, 16)}`;
  if (generation !== expectedGenerationId) throw new Error('Generation folder does not match manifest identity');
  const rawModules = await fs.readFile(modulesPath);
  const modules = modulesFileSchema.parse(JSON.parse(rawModules));
  if (!manifest.modulesSha256 || digestUtf8(rawModules) !== manifest.modulesSha256) throw new Error('Active generation modules checksum mismatch');
  const fingerprint = `${root}:${digestUtf8(rawManifest)}:${manifest.modulesSha256}`;
  let verified = verifiedGenerations.get(fs);
  if (!verified?.has(fingerprint)) {
    await verifyManifestLessons(fs, root, manifest);
    if (!verified) { verified = new Set(); verifiedGenerations.set(fs, verified); }
    if (verified.size >= 8) verified.clear();
    verified.add(fingerprint);
  }
  return { root, manifest, modules, pointerSequence: sequence, generationId: generation };
}

async function verifyManifestLessons(fs: ContentFs, root: string, manifest: Manifest): Promise<void> {
  // Bound native I/O concurrency: avoid 394 serialized bridge round trips without
  // retaining all lesson payloads at once on a small Android device.
  for (let offset = 0; offset < manifest.lessons.length; offset += 8) {
    await Promise.all(manifest.lessons.slice(offset, offset + 8).map(async (entry) => {
    if (entry.file !== `${entry.id}.json`) throw new Error(`Unsafe lesson path ${entry.file}`);
    const path = `${root}${LESSONS_DIR_NAME}/${entry.file}`;
    const raw = await fs.readFile(path);
    if (digestUtf8(raw) !== entry.sha256) throw new Error(`Generation lesson SHA-256 mismatch: ${entry.id}`);
    const lesson = lessonSchema.parse(JSON.parse(raw));
    if (lesson.id !== entry.id) throw new Error(`Generation lesson identity mismatch: ${entry.id}`);
    }));
  }
}

async function recoverRetainedGeneration(fs: ContentFs, base: string, pointers: { sequence: number }[]): Promise<ContentSnapshot | null> {
  const sequence = Math.max(0, ...pointers.map((pointer) => pointer.sequence));
  const directory = `${base}${GENERATIONS_DIR}/`;
  const candidates = (await fs.listDirectory(directory)).map(pathName).filter((name) => /^v\d+_\d+_\d+-[a-f0-9]{16}$/.test(name));
  const snapshots: ContentSnapshot[] = [];
  for (const generation of candidates) {
    try {
      const snapshot = await snapshotFromGeneration(fs, base, generation, sequence);
      if (snapshot) snapshots.push(snapshot);
    } catch { /* Only fully schema- and hash-valid generations are recovery candidates. */ }
  }
  snapshots.sort((left, right) => compareVersions(right.manifest?.version ?? '0.0.0', left.manifest?.version ?? '0.0.0'));
  const latest = snapshots[0];
  return latest ? { ...latest, recoveredFromGeneration: true, recoveryRequired: true } : null;
}

async function readFlatSnapshot(fs: ContentFs, root: string): Promise<ContentSnapshot> {
  const manifestPath = `${root}manifest.json`;
  const modulesPath = `${root}modules.json`;
  let manifest: Manifest | null = null;
  let modules: ModulesFile | null = null;
  try {
    if (await fs.exists(manifestPath)) manifest = manifestSchema.safeParse(JSON.parse(await fs.readFile(manifestPath))).data ?? null;
  } catch { manifest = null; }
  try {
    if (await fs.exists(modulesPath)) {
      const rawModules = await fs.readFile(modulesPath);
      modules = modulesFileSchema.safeParse(JSON.parse(rawModules)).data ?? null;
      if (manifest?.modulesSha256 && digestUtf8(rawModules) !== manifest.modulesSha256) modules = null;
    }
  } catch { modules = null; }
  return { root, manifest, modules, pointerSequence: null, generationId: null };
}

async function readHighestPointerSequence(fs: ContentFs, base: string): Promise<number> {
  const sequences = (await fs.listDirectory(base)).map(pathName).flatMap((name) => {
    const match = SEQUENCED_POINTER.exec(name);
    return match ? [Number(match[1])] : [];
  });
  return Math.max(0, ...sequences);
}

function withGenerationWriteLock<T>(fs: ContentFs, work: () => Promise<T>): Promise<T> {
  const key = fs.documentDirectory.replace(/[/\\]+$/, '');
  const previous = generationWriteTails.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(work);
  const tail = queued.then(() => undefined, () => undefined);
  generationWriteTails.set(key, tail);
  void tail.finally(() => {
    if (generationWriteTails.get(key) === tail) generationWriteTails.delete(key);
    inFlightContentSnapshots.delete(key);
  });
  return queued;
}

export async function readActiveGenerationManifest(fs: ContentFs): Promise<Manifest | null> {
  return (await loadContentSnapshot(fs)).manifest;
}

/** Writes a complete immutable generation, then atomically flips one pointer file. */
export async function commitContentGeneration(fs: ContentFs, input: {
  manifest: unknown;
  rawManifest: string;
  rawModules: string;
  rawLessons: Record<string, string>;
  previousManifest?: Manifest | null;
}): Promise<ValidatedGeneration> {
  return withGenerationWriteLock(fs, () => commitContentGenerationLocked(fs, input));
}

async function commitContentGenerationLocked(fs: ContentFs, input: {
  manifest: unknown;
  rawManifest: string;
  rawModules: string;
  rawLessons: Record<string, string>;
  previousManifest?: Manifest | null;
}): Promise<ValidatedGeneration> {
  const validated = validateGenerationPayload(input);
  const rawManifestParsed = manifestSchema.parse(JSON.parse(input.rawManifest));
  if (JSON.stringify(rawManifestParsed) !== JSON.stringify(validated.manifest)) throw new Error('Manifest serialization mismatch');
  // Never trust the caller's stale previousManifest: the directory-scoped writer lock
  // is held while the actual currently published generation is re-read and compared.
  // Bypass coalesced in-flight readers: commit may run while validation readFile is active.
  const actualSnapshot = await loadContentSnapshotOnce(fs);
  const previous = actualSnapshot.manifest;
  if (previous) {
    const comparison = compareVersions(validated.manifest.version, previous.version);
    if (comparison < 0) throw new Error(`Refusing content downgrade ${previous.version} → ${validated.manifest.version}`);
    if (comparison === 0) {
      if (actualSnapshot.generationId && actualSnapshot.modules && validated.manifestSha256 === digestUtf8(JSON.stringify(previous))) {
        if (!actualSnapshot.recoveryRequired) return validated;
        await publishGenerationPointer(fs, actualSnapshot, actualSnapshot.generationId, previous);
        return validated;
      }
      // Migrate the old flat cache without reserializing its bundled payload.
      // Same-version replacement is allowed only for exactly the same manifest.
      if (actualSnapshot.generationId || validated.manifestSha256 !== digestUtf8(JSON.stringify(previous))) {
        throw new Error(`Content version ${previous.version} already exists with different hashes`);
      }
    }
  }

  const base = `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
  const generationRoot = `${base}${GENERATIONS_DIR}/${validated.generationId}/`;
  verifiedGenerations.delete(fs);
  const lessonsRoot = `${generationRoot}${LESSONS_DIR_NAME}/`;
  await fs.ensureDirectory(generationRoot);
  await fs.ensureDirectory(lessonsRoot);
  await fs.writeFile(`${generationRoot}modules.json`, input.rawModules);
  for (const entry of validated.manifest.lessons) {
    const rawLesson = input.rawLessons[entry.id];
    if (rawLesson === undefined) throw new Error(`Missing lesson payload ${entry.id}`);
    await fs.writeFile(`${lessonsRoot}${entry.file}`, rawLesson);
  }
  // Manifest is written last in the immutable directory. No reader follows it until pointer swap.
  await fs.writeFile(`${generationRoot}manifest.json`, input.rawManifest);
  await publishGenerationPointer(fs, actualSnapshot, validated.generationId, validated.manifest);
  return validated;
}

async function publishGenerationPointer(fs: ContentFs, snapshot: ContentSnapshot, generationId: string, manifest: Manifest): Promise<void> {
  const base = `${fs.documentDirectory}${CONTENT_DIR_NAME}/`;
  const highestKnownSequence = await readHighestPointerSequence(fs, base);
  const sequence = Math.max(snapshot.pointerSequence ?? 0, highestKnownSequence) + 1;
  const pointerName = `${ACTIVE_GENERATION_PREFIX}${String(sequence).padStart(10, '0')}.json`;
  const pointerPath = `${base}${pointerName}`;
  if (await fs.exists(pointerPath)) throw new Error('Generation pointer sequence collision; refusing overwrite');
  const pointerTemp = `${base}${pointerName}.${generationId}.tmp`;
  await fs.writeFile(pointerTemp, JSON.stringify({ generation: generationId, version: manifest.version, manifestSha256: digestUtf8(JSON.stringify(manifest)), sequence }));
  // Fresh same-directory target, never overwrite: Expo legacy moveAsync is renameTo on Android.
  await fs.moveFile(pointerTemp, pointerPath);
}

function compareVersions(left: string, right: string): number {
  const parse = (version: string) => version.split('.').map(Number);
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}
