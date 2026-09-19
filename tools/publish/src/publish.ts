#!/usr/bin/env tsx
// Veroeffentlicht content/manifest.json und geaenderte Lektionen im
// Supabase-Storage-Eimer "content" sowie Hoerdateien und Cue-Sidecars im
// Eimer "audio", und traegt eine Zeile in content_releases ein.
//
// Aufruf: pnpm publish:content -- --dry-run
//         pnpm publish:content -- --audio-dir tools/audio/out
//
// --dry-run zeigt den vollstaendigen Plan, sendet aber nichts: laeuft auch
// ohne SUPABASE_SERVICE_ROLE_KEY. Liegt ein Dienstschluessel vor, wird der
// Plan gegen den tatsaechlich zuletzt veroeffentlichten Stand berechnet
// (genauer, aber weiterhin ohne Upload); ohne Schluessel zeigt der Plan den
// vollen Umfang, als waere noch nichts veroeffentlicht.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { lessonSchema, manifestSchema, type Lesson, type Manifest } from '@futuredev/content-schema';
import { formatAudioPlan, formatContentPlan, withDryRunPrefix } from './format.js';
import { sha256Hex } from './hash.js';
import { loadSupabaseEnv } from './env.js';
import {
  buildPublishManifest,
  planAudioUploads,
  planContentUploads,
  type AudioLocalInfo,
} from './plan.js';
import {
  executeAudioPlan,
  executeContentPlan,
  fetchRemoteAudioShas,
  fetchRemoteManifest,
  insertContentRelease,
} from './supabase-ops.js';
import type { PublishClient } from './supabase-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

/* -------------------------------------------------------------- Argumente */

interface CliArgs {
  readonly dryRun: boolean;
  readonly audioDir: string;
}

export function parseArgs(argv: readonly string[], repoRootPath: string): CliArgs {
  const dryRun = argv.includes('--dry-run');
  const audioDirIndex = argv.indexOf('--audio-dir');
  const audioDirArg = audioDirIndex >= 0 ? argv[audioDirIndex + 1] : undefined;
  const audioDir = audioDirArg ? resolve(repoRootPath, audioDirArg) : join(repoRootPath, 'tools', 'audio', 'out');
  return { dryRun, audioDir };
}

/* --------------------------------------------------------- Inhalt laden */

function loadLocalManifest(): Manifest {
  const path = join(repoRoot, 'content', 'manifest.json');
  if (!existsSync(path)) {
    console.error('publish: content/manifest.json fehlt. Erst "pnpm content:manifest" ausfuehren.');
    process.exit(1);
  }
  const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) {
    console.error('publish: manifest.json entspricht nicht dem Schema, Abbruch:');
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    process.exit(1);
  }
  return parsed.data;
}

/**
 * Liest jede im Manifest gelistete Lektion, prueft sie gegen das Lektionsschema
 * und gleicht ihre tatsaechliche Pruefsumme mit der im Manifest eingetragenen
 * ab. Bricht bei jedem Verstoss ab (Rueckgabewert 1), damit nie eine
 * ungueltige oder veraltete Lektion veroeffentlicht wird.
 */
function loadLocalLessons(manifest: Manifest): Map<string, { lesson: Lesson; raw: string }> {
  const lessonsDir = join(repoRoot, 'content', 'lessons');
  const byId = new Map<string, { lesson: Lesson; raw: string }>();
  for (const entry of manifest.lessons) {
    const path = join(lessonsDir, entry.file);
    if (!existsSync(path)) {
      console.error(`publish: Lektionsdatei fehlt fuer manifest-Eintrag ${entry.id}: ${path}`);
      process.exit(1);
    }
    const raw = readFileSync(path, 'utf8');
    const parsed = lessonSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(`publish: ${entry.file} entspricht nicht dem Lektionsschema, Abbruch:`);
      for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
      process.exit(1);
    }
    const actualSha = sha256Hex(raw);
    if (actualSha !== entry.sha256) {
      console.error(
        `publish: Pruefsumme im Manifest stimmt nicht mit ${entry.file} ueberein. ` +
          'Manifest neu erzeugen mit "pnpm content:manifest".',
      );
      process.exit(1);
    }
    byId.set(entry.id, { lesson: parsed.data, raw });
  }
  return byId;
}

function gatherAudioLocalInfo(audioDir: string, lessonIds: readonly string[]): Map<string, AudioLocalInfo> {
  const map = new Map<string, AudioLocalInfo>();
  for (const id of lessonIds) {
    const mp3Path = join(audioDir, `${id}.mp3`);
    const cuesPath = join(audioDir, `${id}.cues.json`);
    const mp3Exists = existsSync(mp3Path);
    const cuesExists = existsSync(cuesPath);
    map.set(id, {
      id,
      mp3Exists,
      mp3Sha256: mp3Exists ? sha256Hex(readFileSync(mp3Path)) : null,
      cuesExists,
      cuesSha256: cuesExists ? sha256Hex(readFileSync(cuesPath, 'utf8')) : null,
    });
  }
  return map;
}

/* ------------------------------------------------------------------ Lauf */

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), repoRoot);

  const localManifest = loadLocalManifest();
  const lessonEntries = loadLocalLessons(localManifest);
  const lessonRawById = new Map([...lessonEntries].map(([id, entry]) => [id, entry.raw]));
  const publishManifest = buildPublishManifest(localManifest);
  const lessonIds = localManifest.lessons.map((lesson) => lesson.id);

  const env = loadSupabaseEnv(repoRoot);

  // Ohne Dienstschluessel kann kein Stand aus dem Eimer gelesen werden: der
  // Dry-Run zeigt dann den vollen Umfang, als waere noch nichts
  // veroeffentlicht. Mit Schluessel wird auch im Dry-Run gegen den echten
  // zuletzt veroeffentlichten Stand geplant (lesend, es wird nichts gesendet).
  let client: PublishClient | null = null;
  if (env) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) as unknown as PublishClient;
  } else if (!args.dryRun) {
    console.error(
      'publish: SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local. Ohne Dienstschluessel kein Upload moeglich, ' +
        'siehe tools/publish/README.md (Weg ueber den Hauptagenten per MCP als Alternative).',
    );
    return 2;
  }

  const remoteManifest = client ? await fetchRemoteManifest(client, manifestSchema) : null;
  const contentSteps = planContentUploads(localManifest, remoteManifest);

  const audioLocalInfo = gatherAudioLocalInfo(args.audioDir, lessonIds);
  const remoteAudioShas = client
    ? await fetchRemoteAudioShas(client, lessonIds)
    : { mp3: new Map<string, string>(), cues: new Map<string, string>() };
  const audioSteps = planAudioUploads(localManifest.lessons, audioLocalInfo, remoteAudioShas.mp3, remoteAudioShas.cues);

  if (args.dryRun) {
    if (!env) {
      console.log('[dry-run] kein SUPABASE_SERVICE_ROLE_KEY: zeigt den vollen Umfang, als waere noch nichts veroeffentlicht.');
    }
    for (const line of withDryRunPrefix(formatContentPlan(contentSteps))) console.log(line);
    for (const line of withDryRunPrefix(formatAudioPlan(audioSteps))) console.log(line);
    console.log('[dry-run] nichts gesendet.');
    return 0;
  }

  if (!client || !env) {
    // Kann hier nicht mehr eintreten (oben bereits abgefangen), aber macht
    // den Kontrollfluss fuer den Typchecker eindeutig.
    return 2;
  }

  try {
    await executeContentPlan(client, contentSteps, lessonRawById, publishManifest, (line) => console.log(line));
    await executeAudioPlan(
      client,
      audioSteps,
      (id) => readFileSync(join(args.audioDir, `${id}.mp3`)),
      (id) => readFileSync(join(args.audioDir, `${id}.cues.json`), 'utf8'),
      (line) => console.log(line),
    );

    const manifestStep = contentSteps.find((step) => step.kind === 'manifest');
    if (manifestStep && manifestStep.kind === 'manifest' && manifestStep.changed) {
      const manifestUrl = `${env.SUPABASE_URL}/storage/v1/object/public/content/manifest.json`;
      await insertContentRelease(client, publishManifest, manifestUrl, (line) => console.log(line));
    } else {
      console.log('content_releases: keine Aenderung am Manifest, kein neuer Eintrag.');
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  return 0;
}

// Nur ausfuehren, wenn direkt als CLI gestartet (nicht beim Import in Tests,
// z. B. fuer parseArgs in publish-args.test.ts).
const isCliEntry = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCliEntry) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
