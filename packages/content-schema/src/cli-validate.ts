#!/usr/bin/env tsx
// Liest content/lessons/*.json und content/manifest.json, prüft Schema und Regeln,
// nennt jede Verletzung mit Datei und Regel, endet mit Rückgabewert 1 bei Fund.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonSchema } from './lesson.js';
import { manifestSchema } from './manifest.js';
import { checkAllRules } from './rules.js';
import { modulesFileSchema } from './modules.js';
import type { Lesson } from './lesson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const contentDir = join(repoRoot, 'content');
const lessonsDir = join(contentDir, 'lessons');
const manifestPath = join(contentDir, 'manifest.json');
const modulesPath = join(contentDir, 'modules.json');

let errorCount = 0;

function reportError(file: string, rule: string, message: string): void {
  errorCount += 1;
  console.error(`FEHLER ${file} [${rule}]: ${message}`);
}

function main(): void {
  if (!existsSync(lessonsDir)) {
    console.error('content:validate: Ordner content/lessons fehlt.');
    process.exit(1);
  }

  const lessonFiles = readdirSync(lessonsDir).filter((f) => f.endsWith('.json'));

  if (lessonFiles.length === 0) {
    console.error('content:validate: keine Lektionen gefunden (content/lessons ist leer).');
    process.exit(1);
  }

  const lessons: Lesson[] = [];

  for (const file of lessonFiles) {
    const path = join(lessonsDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      reportError(file, 'json-parsen', String(err));
      continue;
    }
    const result = lessonSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        reportError(file, 'schema', `${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    lessons.push(result.data);
  }

  for (const lesson of lessons) {
    const violations = checkAllRules(lesson, lessons);
    for (const v of violations) {
      reportError(`${lesson.id}.json`, v.rule, v.message);
    }
  }

  let totalQuestions = 0;
  for (const lesson of lessons) {
    totalQuestions += lesson.quiz.length;
  }

  if (existsSync(manifestPath)) {
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      reportError('manifest.json', 'json-parsen', String(err));
      manifestRaw = undefined;
    }
    if (manifestRaw !== undefined) {
      const manifestResult = manifestSchema.safeParse(manifestRaw);
      if (!manifestResult.success) {
        for (const issue of manifestResult.error.issues) {
          reportError('manifest.json', 'schema', `${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        const lessonIds = new Set(lessons.map((l) => l.id));
        for (const entry of manifestResult.data.lessons) {
          if (!lessonIds.has(entry.id)) {
            reportError('manifest.json', 'manifest-verweis', `Lektion ${entry.id} fehlt unter content/lessons`);
          }
        }
      }
    }
  } else {
    console.error('content:validate: content/manifest.json fehlt, wird von content:manifest erzeugt.');
    errorCount += 1;
  }

  if (existsSync(modulesPath)) {
    let modulesRaw: unknown;
    try {
      modulesRaw = JSON.parse(readFileSync(modulesPath, 'utf8'));
    } catch (err) {
      reportError('modules.json', 'json-parsen', String(err));
      modulesRaw = undefined;
    }
    if (modulesRaw !== undefined) {
      const modulesResult = modulesFileSchema.safeParse(modulesRaw);
      if (!modulesResult.success) {
        for (const issue of modulesResult.error.issues) {
          reportError('modules.json', 'schema', `${issue.path.join('.')}: ${issue.message}`);
        }
      }
    }
  } else {
    reportError('modules.json', 'fehlt', 'content/modules.json fehlt.');
  }

  if (errorCount > 0) {
    console.error(`content:validate: ${errorCount} Verletzung(en).`);
    process.exit(1);
  }

  console.log(`content:validate: ${lessons.length} Lektion(en), ${totalQuestions} Frage(n), keine Verletzung.`);
}

main();
