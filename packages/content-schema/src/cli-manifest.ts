#!/usr/bin/env tsx
// Erzeugt content/manifest.json neu aus content/lessons/*.json: Prüfsumme je Datei,
// updatedAt aus dem letzten Git-Commit der Datei (Fallback Dateizeit).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonSchema } from './lesson.js';
import type { Manifest } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const contentDir = join(repoRoot, 'content');
const lessonsDir = join(contentDir, 'lessons');
const manifestPath = join(contentDir, 'manifest.json');

// Vorläufig: Supabase-Projekt existiert erst ab Phase 3. Platzhalter-Basis-URLs,
// werden dort ersetzt.
const CONTENT_BASE_URL = 'https://futuredev.supabase.co/storage/v1/object/public/content';
const AUDIO_BASE_URL = 'https://futuredev.supabase.co/storage/v1/object/public/audio';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function updatedAtFor(path: string): string {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', path], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (out) return out;
  } catch {
    // kein Git-Verlauf, etwa vor dem ersten Commit: auf Dateizeit ausweichen.
  }
  return new Date(statSync(path).mtime).toISOString();
}

function main(): void {
  if (!existsSync(lessonsDir)) {
    console.error('content:manifest: Ordner content/lessons fehlt.');
    process.exit(1);
  }

  const files = readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort();
  const lessons: Manifest['lessons'] = [];

  for (const file of files) {
    const path = join(lessonsDir, file);
    const raw = readFileSync(path, 'utf8');
    const parsed = lessonSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(`content:manifest: ${file} entspricht nicht dem Lektionsschema, übersprungen.`);
      continue;
    }
    lessons.push({
      id: parsed.data.id,
      file,
      sha256: sha256(raw),
      updatedAt: updatedAtFor(path),
    });
  }

  let version = '0.1.0';
  if (existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string };
      if (existing.version) version = existing.version;
    } catch {
      // vorhandenes Manifest unlesbar: bei 0.1.0 bleiben.
    }
  }

  const manifest: Manifest = {
    version,
    contentBaseUrl: CONTENT_BASE_URL,
    audioBaseUrl: AUDIO_BASE_URL,
    lessons,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`content:manifest: ${lessons.length} Lektion(en) in manifest.json geschrieben.`);
}

main();
