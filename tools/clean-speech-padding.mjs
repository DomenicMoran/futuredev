import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DIR = path.join(ROOT, 'content/lessons');
const TEMPLATE = 'Genau so lernen wir hier. Erst ein Bild aus dem Alltag. Dann die Erklärung in kurzen Sätzen. Dann der Fachbegriff. Dann ein zweites Beispiel. Zum Schluss warum es zählt.';

export function cleanSpeechBlock(text) {
  let value = text;
  value = value.replace(/\s*Das gilt besonders für den Teil \d+\.?\s*$/u, '').trim();
  value = value.replace(/In echten Projekten scheitert .*? selten an fehlender Intelligenz(?:, sondern an fehlender Klarheit)?\.\s*/u, '').trim();
  if (value === TEMPLATE) return '';
  return value;
}

export function cleanSpeechPadding({ write = false, directory = DIR } = {}) {
  let changed = 0;
  let removed = 0;
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  for (const name of files) {
    const file = path.join(directory, name);
    const original = fs.readFileSync(file, 'utf8');
    const lesson = JSON.parse(original);
    let dirty = false;
    lesson.speechBlocks = lesson.speechBlocks.flatMap((block) => {
      const text = cleanSpeechBlock(block.text);
      if (text === block.text) return [block];
      dirty = true;
      changed++;
      if (!text) { removed++; return []; }
      return [{ ...block, text }];
    });
    if (dirty && write) fs.writeFileSync(file, JSON.stringify(lesson, null, 2) + '\n', 'utf8');
  }
  return { files: files.length, changed, removed, write };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  const result = cleanSpeechPadding({ write: process.argv.includes('--write') });
  console.log(`${result.write ? 'Updated' : 'Would update'} ${result.changed} speech blocks (${result.removed} template-only blocks removed) across ${result.files} lessons.`);
}
