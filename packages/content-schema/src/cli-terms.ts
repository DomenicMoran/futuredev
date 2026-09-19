#!/usr/bin/env tsx
// Werkzeug für Autoren (AP-4.2, Auftrag Punkt 2): listet je Begriff alle
// Lektionen, die ihn unter `terms` einführen, und zeigt Kollisionen (ein
// Begriff, der in mehr als einer Lektion eingeführt wird). Regel:
// "Begriffs-Eigentümer" ist genau eine Lektion, die früheste in der
// Kennungsreihenfolge, die den Begriff wirklich erklärt. Andere Lektionen
// benutzen den Begriff im Text weiter (Wiederholung schadet nicht), listen
// den Eigentümer aber nur noch in `prerequisites` (direkt oder transitiv)
// statt ihn erneut unter `terms` zu führen.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonSchema } from './lesson.js';
import type { Lesson } from './lesson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const lessonsDir = join(repoRoot, 'content', 'lessons');

function loadLessons(): Lesson[] {
  if (!existsSync(lessonsDir)) {
    console.error('content:terms: Ordner content/lessons fehlt.');
    process.exit(1);
  }
  const files = readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort();
  const lessons: Lesson[] = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(lessonsDir, file), 'utf8'));
    const result = lessonSchema.safeParse(raw);
    if (!result.success) {
      console.error(`content:terms: ${file} entspricht nicht dem Lektionsschema, übersprungen.`);
      continue;
    }
    lessons.push(result.data);
  }
  return lessons;
}

function main(): void {
  const lessons = loadLessons();
  // Kennungsreihenfolge = Dateireihenfolge, weil Dateien nach Kennung
  // benannt sind und alphabetisch sortiert der Lernreihenfolge entsprechen.
  const orderIndex = new Map(lessons.map((l, i) => [l.id, i]));

  const owners = new Map<string, string[]>(); // Begriff (lower) -> [Lektions-IDs]
  const definitionByTermAndLesson = new Map<string, string>(); // "begriff|lektion" -> Definition

  for (const lesson of lessons) {
    for (const t of lesson.terms) {
      const key = t.term.toLowerCase();
      const existing = owners.get(key);
      if (existing) {
        existing.push(lesson.id);
      } else {
        owners.set(key, [lesson.id]);
      }
      definitionByTermAndLesson.set(`${key}|${lesson.id}`, t.definition);
    }
  }

  const sortedTerms = [...owners.keys()].sort((a, b) => a.localeCompare(b, 'de'));
  let collisionCount = 0;

  console.log(`content:terms: ${sortedTerms.length} Begriff(e) über ${lessons.length} Lektion(en).\n`);

  for (const term of sortedTerms) {
    const ids = owners.get(term) ?? [];
    const lessonIds = ids
      .slice()
      .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
    const isCollision = lessonIds.length > 1;
    if (isCollision) collisionCount += 1;
    const marker = isCollision ? 'KOLLISION' : '         ';
    const owner = lessonIds[0];
    console.log(`${marker}  ${term.padEnd(28)} Eigentümer: ${owner}${isCollision ? `  auch eingeführt in: ${lessonIds.slice(1).join(', ')}` : ''}`);
  }

  console.log(`\ncontent:terms: ${collisionCount} Kollision(en) von ${sortedTerms.length} Begriffen.`);
  if (collisionCount > 0) {
    console.log('Ein Begriff gehört genau einer Lektion (die früheste, die ihn erklärt).');
    console.log('Andere Lektionen entfernen ihn aus "terms" und tragen den Eigentümer (direkt oder transitiv) in "prerequisites" ein.');
  }
}

main();
