import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PADDING = /Weitere Aspekte, die in diesem Zusammenhang|Zusaetzlicher Kontext fuer diese Antwortoption|sowie weitere Aspekte, die in diesem Zusammenhang/i;
export const SPEECH_PADDING = /Das gilt besonders für den Teil \d+|In echten Projekten scheitert .+ selten an fehlender Intelligenz|Genau so lernen wir hier\. Erst ein Bild aus dem Alltag/i;
export function auditLesson(lesson) {
  const findings = [];
  lesson.speechBlocks.forEach((block, index) => {
    if (SPEECH_PADDING.test(block.text)) findings.push({ block: index, kind: 'generic-speech-padding', severity: 'error' });
  });
  for (const q of lesson.quiz) {
    const seen = new Set();
    for (const [index, option] of q.options.entries()) {
      const normalized = option.text.trim().toLocaleLowerCase('de');
      if (PADDING.test(option.text)) findings.push({ questionId: q.questionId, option: index, kind: 'artificial-padding', severity: 'error' });
      if (seen.has(normalized)) findings.push({ questionId: q.questionId, option: index, kind: 'duplicate-option', severity: 'error' });
      seen.add(normalized);
    }
    if (q.question.trim().split(/\s+/).length < 4) findings.push({ questionId: q.questionId, kind: 'short-context-poor-stem', severity: 'review' });
  }
  const spoken = lesson.speechBlocks.map((b) => b.text).join(' ').toLowerCase();
  const questions = lesson.quiz.map((q) => [q.question, ...q.options.map((o) => o.text)].join(' ')).join(' ').toLowerCase();
  const termsWithoutExplicitQuestion = lesson.terms.filter((t) => spoken.includes(t.term.toLowerCase()) && !questions.includes(t.term.toLowerCase())).map((t) => t.term);
  return { lessonId: lesson.id, title: lesson.title, questions: lesson.quiz.length, findings, termsWithoutExplicitQuestion,
    coverageWarning: 'Term matching is a review aid, not proof of semantic coverage or correctness.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const lessons = fs.readdirSync(path.join(root, 'content/lessons')).filter((name) => name.endsWith('.json')).sort().map((name) => auditLesson(JSON.parse(fs.readFileSync(path.join(root, 'content/lessons', name), 'utf8'))));
  const failures = lessons.flatMap((l) => l.findings.filter((f) => f.severity === 'error'));
  const report = { status: failures.length ? 'failed' : 'automated-checks-passed-not-human-certification', errors: failures.length, lessons };
  const out = process.argv.indexOf('--out');
  if (out >= 0 && process.argv[out + 1]) fs.writeFileSync(path.resolve(process.argv[out + 1]), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Learning audit: ${lessons.length} lessons, ${failures.length} errors. Semantic/pedagogical review is separate.\n`);
  process.exitCode = failures.length ? 1 : 0;
}
