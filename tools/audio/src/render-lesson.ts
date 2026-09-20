#!/usr/bin/env tsx
// Vertont eine Lektion ueber die ElevenLabs-API zu einer fertigen MP3-Datei.
//
// Ablauf: Lektion einlesen und gegen das Schema pruefen, je Sprechblock eine
// MP3 erzeugen (Sprecher A ueber VOICE_ID_ERKLAERT, Sprecher B ueber
// VOICE_ID_FRAGT, Modell eleven_multilingual_v2), Bloecke mit ffmpeg zu einer
// Datei zusammenfuegen (300 ms Stille zwischen Bloecken derselben Stimme,
// 600 ms bei Sprecherwechsel), ID3-Tags schreiben, Dauer mit ffprobe messen.
//
// Abbruchfest wie das BitDojo-Vorbild (werkzeug/podcast-vertonen.mjs): jeder
// Block liegt einzeln unter tools/audio/out/<lektion>/<lektion>-b001.mp3, eine
// Pruefsumme aus Sprecher und Text entscheidet, ob ein Block neu vertont
// werden muss. Ein zweiter Lauf ueberspringt, was schon passt.
//
// Aufruf: pnpm --filter @futuredev/tools-audio render -- --lesson M01-01-01
//         pnpm --filter @futuredev/tools-audio render -- --lesson M01-01-01 --dry-run

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cueSheetSchema, lessonSchema, type Lesson, type SpeechBlock } from '@futuredev/content-schema';
import { buildConcatPlan, type ConcatStep } from './concat-plan.js';
import { buildCueSheet } from './cues.js';
import { estimateCostByTier } from './pricing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const lessonsDir = join(repoRoot, 'content', 'lessons');
const outDir = join(repoRoot, 'tools', 'audio', 'out');

const MODEL = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

/* --------------------------------------------------------------- Umgebung */

interface EnvValues {
  readonly ELEVENLABS_API_KEY: string;
  readonly VOICE_ID_ERKLAERT: string;
  readonly VOICE_ID_FRAGT: string;
}

/**
 * Liest .env.local aus der Repo-Wurzel. Gibt die Werte nie aus, auch nicht in
 * einer Fehlermeldung: nur der Variablenname erscheint im Log.
 */
function readEnvLocal(): Partial<EnvValues> {
  const path = join(repoRoot, '.env.local');
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#') || !line.includes('=')) continue;
    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

function requireEnv(): EnvValues {
  const fromFile = readEnvLocal();
  const get = (name: keyof EnvValues): string | undefined => process.env[name] ?? fromFile[name];
  const missing: string[] = [];
  const result: Record<string, string> = {};
  for (const name of ['ELEVENLABS_API_KEY', 'VOICE_ID_ERKLAERT', 'VOICE_ID_FRAGT'] as const) {
    const value = get(name);
    if (!value) missing.push(name);
    else result[name] = value;
  }
  if (missing.length > 0) {
    console.error(`Fehlende Umgebungsvariable(n) in .env.local: ${missing.join(', ')}`);
    process.exit(1);
  }
  return result as unknown as EnvValues;
}

/* -------------------------------------------------------------- Argumente */

interface Args {
  readonly dryRun: boolean;
  readonly lessonId: string | undefined;
  // Nur die Cue-Datei (Kapitelmarken) neu berechnen: kein Zusammenfuegen, keine
  // ID3-Tags, kein neuer API-Aufruf, solange die Block-MP3s schon vorliegen.
  readonly cuesOnly: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const dryRun = argv.includes('--dry-run');
  const cuesOnly = argv.includes('--cues-only');
  const lessonIndex = argv.indexOf('--lesson');
  const lessonId = lessonIndex >= 0 ? argv[lessonIndex + 1] : undefined;
  return { dryRun, lessonId, cuesOnly };
}

/* ---------------------------------------------------------- Lektion laden */

function loadLesson(id: string): Lesson {
  const path = join(lessonsDir, `${id}.json`);
  if (!existsSync(path)) {
    console.error(`Lektion nicht gefunden: ${path}`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = lessonSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`${id}.json entspricht nicht dem Lektionsschema:`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

function loadAllLessonIds(): string[] {
  if (!existsSync(lessonsDir)) return [];
  return readdirSync(lessonsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/* -------------------------------------------------------------- Vertonung */

const VOICE_ID_BY_SPEAKER = (env: EnvValues) =>
  ({ A: env.VOICE_ID_ERKLAERT, B: env.VOICE_ID_FRAGT }) as const;

/** Fehler der ElevenLabs-API, mit Status, ohne den Schluessel zu loggen. */
class ElevenLabsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ElevenLabsError';
  }
}

// Maskiert lange Token-artige Zeichenketten (Schluessel, Signaturen) im
// Antworttext, bevor er geloggt wird: nie den Schluessel oder Aehnliches im
// Klartext ausgeben, auch nicht in einer Fehlermeldung.
function maskSecrets(text: string): string {
  return text.replace(/[A-Za-z0-9_-]{30,}/g, '<gekuerzt>');
}

const RETRY_DELAY_MS = 30_000;

async function requestSpeech(
  env: EnvValues,
  text: string,
  voiceId: string,
): Promise<{ ok: true; audio: Buffer } | { ok: false; status: number; bodyText: string }> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: { stability: 0.55, similarity_boost: 0.7, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (response.ok) return { ok: true, audio: Buffer.from(await response.arrayBuffer()) };
  const bodyText = await response.text().catch(() => '');
  return { ok: false, status: response.status, bodyText };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Spricht einen Block. Bei 401, 429 oder 5xx wird der (maskierte) Antworttext
 * geloggt und genau einmal nach 30 Sekunden wiederholt; scheitert auch der
 * zweite Versuch, bricht der Lauf ab (kein zweiter Retry, kein stilles
 * Weitermachen). Andere 4xx-Fehler (z. B. 400 bei ungueltigem Text) werden
 * sofort und ohne Wiederholung gemeldet, weil ein Retry daran nichts aendert.
 */
async function speak(env: EnvValues, text: string, voiceId: string): Promise<Buffer> {
  const isRetryable = (status: number) => status === 401 || status === 429 || status >= 500;

  let result = await requestSpeech(env, text, voiceId);
  if (result.ok) return result.audio;

  console.error(
    `  ElevenLabs meldet ${result.status}: ${maskSecrets(result.bodyText).slice(0, 300)}`,
  );

  if (isRetryable(result.status)) {
    console.error(`  Wiederholung in ${RETRY_DELAY_MS / 1000} s (einmalig)...`);
    await sleep(RETRY_DELAY_MS);
    result = await requestSpeech(env, text, voiceId);
    if (result.ok) return result.audio;
    console.error(
      `  Wiederholung ebenfalls fehlgeschlagen (${result.status}): ${maskSecrets(result.bodyText).slice(0, 300)}`,
    );
  }

  if (result.status === 401) {
    throw new ElevenLabsError(401, 'ElevenLabs meldet 401 beim Sprechen selbst. Schluessel prüfen (nie ausgeben).');
  }
  if (result.status === 429) {
    throw new ElevenLabsError(429, 'ElevenLabs meldet 429 (Kontingent oder Rate-Limit). Lauf wird nicht wiederholt.');
  }
  if (result.status >= 500) {
    throw new ElevenLabsError(result.status, `ElevenLabs meldet Serverfehler ${result.status}.`);
  }
  throw new ElevenLabsError(
    result.status,
    `ElevenLabs meldet ${result.status}: ${maskSecrets(result.bodyText).slice(0, 300)}`,
  );
}

function blockChecksum(block: SpeechBlock): string {
  return createHash('sha256').update(`${block.speaker}\n${block.text}`).digest('hex').slice(0, 16);
}

function blockFile(lessonOutDir: string, lessonId: string, index: number): string {
  return join(lessonOutDir, `${lessonId}-b${String(index + 1).padStart(3, '0')}.mp3`);
}

async function renderBlocks(env: EnvValues, lesson: Lesson, lessonOutDir: string): Promise<void> {
  const checksumPath = join(lessonOutDir, `${lesson.id}.checksums.json`);
  const previousChecksums: Record<string, string> = existsSync(checksumPath)
    ? JSON.parse(readFileSync(checksumPath, 'utf8'))
    : {};
  const currentChecksums: Record<string, string> = {};

  for (const [index, block] of lesson.speechBlocks.entries()) {
    const checksum = blockChecksum(block);
    const path = blockFile(lessonOutDir, lesson.id, index);
    const recorded = previousChecksums[String(index)];
    // Ohne fruehere Prüfsumme (etwa nach einem Abbruch mitten im Lauf, bevor
    // die Checksums-Datei geschrieben wurde) gilt eine vorhandene Blockdatei
    // als gueltig: kein erneuter API-Aufruf fuer laengst vorhandene Bloecke.
    // Nur eine abweichende, tatsaechlich frueher aufgezeichnete Pruefsumme
    // loest eine Neuvertonung aus.
    const knownChanged = recorded !== undefined && recorded !== checksum;
    currentChecksums[String(index)] = checksum;
    if (existsSync(path) && !knownChanged) continue;

    const voiceId = VOICE_ID_BY_SPEAKER(env)[block.speaker];
    console.log(`  Block ${index + 1}/${lesson.speechBlocks.length} (Sprecher ${block.speaker})`);
    const audio = await speak(env, block.text, voiceId);
    writeFileSync(path, audio);
    // Nach jedem einzelnen Block sichern, damit ein Abbruch (401/429/5xx nach
    // dem einen Retry) den Fortschritt nicht verliert und ein zweiter Lauf
    // wirklich nur den Rest sendet.
    writeFileSync(checksumPath, JSON.stringify(currentChecksums, null, 2) + '\n');
  }

  writeFileSync(checksumPath, JSON.stringify(currentChecksums, null, 2) + '\n');
}

/* ----------------------------------------------------------- Zusammenfuegen */

function silenceFile(lessonOutDir: string, milliseconds: number): string {
  return join(lessonOutDir, `silence-${milliseconds}ms.mp3`);
}

function ensureSilenceFiles(lessonOutDir: string, plan: readonly ConcatStep[]): void {
  const durations = new Set(plan.filter((s) => s.type === 'silence').map((s) => s.milliseconds));
  for (const ms of durations) {
    const path = silenceFile(lessonOutDir, ms);
    if (existsSync(path)) continue;
    execFileSync('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=44100:cl=mono`,
      '-t',
      String(ms / 1000),
      '-q:a',
      '9',
      path,
    ]);
  }
}

function concatLesson(lesson: Lesson, lessonOutDir: string): string {
  const plan = buildConcatPlan(lesson.speechBlocks);
  ensureSilenceFiles(lessonOutDir, plan);

  const listPath = join(lessonOutDir, `${lesson.id}.concat.txt`);
  const lines = plan.map((step) => {
    const path =
      step.type === 'block'
        ? blockFile(lessonOutDir, lesson.id, step.index)
        : silenceFile(lessonOutDir, step.milliseconds);
    return `file '${path.replace(/\\/g, '/')}'`;
  });
  writeFileSync(listPath, lines.join('\n'), 'utf8');

  const outputPath = join(outDir, `${lesson.id}.mp3`);
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
    outputPath,
  ]);
  return outputPath;
}

function writeId3Tags(lesson: Lesson, mp3Path: string): void {
  const tagged = `${mp3Path}.tagged.mp3`;
  execFileSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    mp3Path,
    '-c',
    'copy',
    '-metadata',
    `title=${lesson.title}`,
    '-metadata',
    'album=FutureDev',
    '-metadata',
    'comment=KI-generierte Stimme (ElevenLabs), Kennzeichnung nach EU AI Act Art. 50',
    tagged,
  ]);
  execFileSync('node', ['-e', `require('fs').renameSync(${JSON.stringify(tagged)}, ${JSON.stringify(mp3Path)})`]);
}

function measureDurationSeconds(mp3Path: string): number {
  return Math.round(measureDurationSecondsPrecise(mp3Path));
}

/** Ungerundete Dauer (Sekunden, Fliesskomma), fuer Kapitelmarken: ueber 68
 * Bloecke summiert sich ein Rundungsfehler von einer ganzen Sekunde je Block
 * sonst zu einer spuerbar falschen Sprungmarke auf. */
function measureDurationSecondsPrecise(mp3Path: string): number {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    mp3Path,
  ])
    .toString()
    .trim();
  return Number(output);
}

/* -------------------------------------------------------------- Cue-Sidecar */

/** Ob jeder Block-MP3-Pfad einer Lektion vorhanden ist. */
function allBlocksExist(lesson: Lesson, lessonOutDir: string): boolean {
  return lesson.speechBlocks.every((_, index) => existsSync(blockFile(lessonOutDir, lesson.id, index)));
}

/**
 * Baut die Cue-Datei (Kapitelmarken) aus den bereits vorliegenden Block-MP3s
 * und schreibt sie nach tools/audio/out/<id>.cues.json. Braucht keinen
 * API-Aufruf, nur ffprobe je Block.
 */
function writeCueSheet(lesson: Lesson, lessonOutDir: string): string {
  const durations = lesson.speechBlocks.map((_, index) =>
    measureDurationSecondsPrecise(blockFile(lessonOutDir, lesson.id, index)),
  );
  const cueSheet = cueSheetSchema.parse(buildCueSheet(lesson.id, lesson.speechBlocks, durations));
  const cuesPath = join(outDir, `${lesson.id}.cues.json`);
  writeFileSync(cuesPath, JSON.stringify(cueSheet, null, 2) + '\n');
  return cuesPath;
}

/* --------------------------------------------------------------- Hauptlauf */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const lessonIds = args.lessonId ? [args.lessonId] : loadAllLessonIds();

  if (lessonIds.length === 0) {
    console.error('Keine Lektion angegeben und keine Lektionen unter content/lessons gefunden.');
    process.exit(1);
  }

  for (const lessonId of lessonIds) {
    const lesson = loadLesson(lessonId);
    const characters = lesson.speechBlocks.reduce((sum, b) => sum + b.text.length, 0);
    const estimates = estimateCostByTier(characters);

    console.log(`${lesson.id}: ${lesson.speechBlocks.length} Blöcke, ${characters} Zeichen`);
    console.log('  Geschätzte Kosten je Tarif (ohne Berücksichtigung von Restkontingent):');
    for (const e of estimates) {
      console.log(
        `    ${e.tier}: ${e.usd.toFixed(2)} USD${e.fitsInOneMonth ? '' : ' (überschreitet Monatskontingent)'}`,
      );
    }

    if (args.dryRun) continue;

    const lessonOutDir = join(outDir, lesson.id);
    mkdirSync(lessonOutDir, { recursive: true });

    if (args.cuesOnly) {
      if (!allBlocksExist(lesson, lessonOutDir)) {
        console.log(`  einzelne Block-MP3s fehlen, werden mit dem vorhandenen Schlüssel einmalig nachvertont.`);
        const env = requireEnv();
        try {
          await renderBlocks(env, lesson, lessonOutDir);
        } catch (err) {
          if (err instanceof ElevenLabsError) {
            console.error(`${lesson.id}: Abbruch (${err.status}): ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
      const cuesPath = writeCueSheet(lesson, lessonOutDir);
      console.log(`  Cue-Datei: ${cuesPath} (${lesson.speechBlocks.length} Blöcke, --cues-only)`);
      continue;
    }

    const env = requireEnv();
    try {
      await renderBlocks(env, lesson, lessonOutDir);
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        console.error(`${lesson.id}: Abbruch (${err.status}): ${err.message}`);
        process.exit(1);
      }
      throw err;
    }

    const outputPath = concatLesson(lesson, lessonOutDir);
    writeId3Tags(lesson, outputPath);
    const cuesPath = writeCueSheet(lesson, lessonOutDir);
    const durationSeconds = measureDurationSeconds(outputPath);
    const sizeKb = Math.round(statSync(outputPath).size / 1024);

    console.log(
      `  fertig: ${outputPath}, ${sizeKb} KB, ${Math.floor(durationSeconds / 60)}:${String(
        durationSeconds % 60,
      ).padStart(2, '0')} Min, Cue-Datei: ${cuesPath}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
