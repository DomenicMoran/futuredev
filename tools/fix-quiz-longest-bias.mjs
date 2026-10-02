#!/usr/bin/env node
/** Report-only quiz answer length diagnostic. Never rewrites content. */
import fs from 'node:fs';
import path from 'node:path';

const LESSONS_DIR = path.resolve('content/lessons');
const files = fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json')).sort();
const lessons = [];
for (const file of files) {
  const lesson = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, file), 'utf8'));
  let longestCorrect = 0;
  const flags = [];
  for (const [qi, q] of (lesson.quiz ?? []).entries()) {
    const max = Math.max(...q.options.map((o) => o.text.length));
    if (q.options.some((o) => o.isCorrect && o.text.length === max)) longestCorrect++;
    if (q.options.some((o) => /(?:…|\.\.\.)\s*$/.test(o.text))) flags.push({ question: qi + 1, kind: 'terminal-ellipsis' });
    if (q.options.some((o) => !o.isCorrect && /Das passt zur Fragestellung hier nicht\.|Das trifft auf den Kern dieser Frage nicht zu/i.test(o.text))) flags.push({ question: qi + 1, kind: 'distractor-giveaway-or-padding' });
  }
  lessons.push({ file, questions: lesson.quiz?.length ?? 0, longestCorrectShare: lesson.quiz?.length ? longestCorrect / lesson.quiz.length : 0, editorialFlags: flags });
}
const report = { mode: 'report-only', mutatedFiles: [], lessonCount: lessons.length, lessons };
const output = process.argv[2];
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) fs.writeFileSync(path.resolve(output), json);
else process.stdout.write(json);
