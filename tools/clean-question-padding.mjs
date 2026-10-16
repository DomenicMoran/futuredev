import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = path.join(root, 'content', 'lessons');
const markers = [
  'Weitere Aspekte, die in diesem Zusammenhang',
  'Zusaetzlicher Kontext fuer diese Antwortoption',
  'sowie weitere Aspekte, die in diesem Zusammenhang',
];

export function stripArtificialQuestionPadding(value) {
  let cutoff = -1;
  for (const marker of markers) {
    const index = value.toLocaleLowerCase('de-DE').indexOf(marker.toLocaleLowerCase('de-DE'));
    if (index >= 0 && (cutoff < 0 || index < cutoff)) cutoff = index;
  }
  if (cutoff < 0) return value;
  const base = value.slice(0, cutoff).trim().replace(/[.,;:]+$/u, '').trim();
  if (!base) throw new Error('Artificial padding marker would remove the whole answer option');
  const cleaned = /[.!?]$/u.test(base) ? base : `${base}.`;
  return cleaned;
}

export async function cleanQuestionPadding({ write = false } = {}) {
  const files = (await readdir(lessonsDir)).filter((name) => name.endsWith('.json')).sort();
  let changedOptions = 0;
  let changedLessons = 0;
  for (const name of files) {
    const file = path.join(lessonsDir, name);
    const source = await readFile(file, 'utf8');
    const lesson = JSON.parse(source);
    let lessonChanged = false;
    for (const question of lesson.quiz ?? []) {
      for (const option of question.options ?? []) {
        const cleaned = stripArtificialQuestionPadding(option.text);
        if (cleaned !== option.text) {
          option.text = cleaned;
          changedOptions += 1;
          lessonChanged = true;
        }
      }
    }
    if (lessonChanged) {
      changedLessons += 1;
      if (write) await writeFile(file, `${JSON.stringify(lesson, null, 2)}\n`, 'utf8');
    }
  }
  return { changedOptions, changedLessons };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const { changedOptions, changedLessons } = await cleanQuestionPadding({ write });
  console.log(`${write ? 'Wrote' : 'Would clean'} ${changedOptions} option(s) in ${changedLessons} lesson(s)${write ? '.' : '; pass --write to apply.'}`);
}
