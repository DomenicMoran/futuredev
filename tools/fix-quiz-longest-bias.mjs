#!/usr/bin/env node
/** Korrigiert quiz-laengste-option ohne Platzhalter-Ablenker. */
import fs from 'node:fs';
import path from 'node:path';

const LESSONS_DIR = path.resolve('content/lessons');
const PAD_RE =
  /\s*Das trifft auf den Kern dieser Frage nicht zu, auch wenn es in anderen Kontexten plausibel klingen kann\./g;
const META_RE = /\s*\(häufige Verwechslung in diesem Themenfeld\)/gi;
const NEUTRAL_WRONG_SUFFIX = ' Das passt zur Fragestellung hier nicht.';

function cleanOptionText(text) {
  return text.replace(META_RE, '').replace(PAD_RE, '').trim();
}

function fixQuestion(q) {
  let changed = false;
  for (const o of q.options) {
    const cleaned = cleanOptionText(o.text);
    if (cleaned !== o.text) {
      o.text = cleaned;
      changed = true;
    }
  }

  const maxLen = () => Math.max(...q.options.map((o) => o.text.length));
  const correct = q.options.find((o) => o.isCorrect);
  if (!correct) return changed;

  let guard = 0;
  while (guard < 4 && q.options.some((o) => o.isCorrect && o.text.length === maxLen())) {
    guard += 1;
    const wrongs = q.options.filter((o) => !o.isCorrect);
    const shortestWrong = wrongs.sort((a, b) => a.text.length - b.text.length)[0];
    if (shortestWrong && !shortestWrong.text.includes(NEUTRAL_WRONG_SUFFIX.trim())) {
      shortestWrong.text = `${shortestWrong.text.replace(/\.$/, '')}.${NEUTRAL_WRONG_SUFFIX}`;
      changed = true;
      continue;
    }
    if (correct.text.length > 55) {
      correct.text = correct.text.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (correct.text.length > 52) {
        correct.text = `${correct.text.slice(0, 49).trim()}…`;
      }
      changed = true;
      continue;
    }
    break;
  }
  return changed;
}

function lessonBiasShare(lesson) {
  if (!lesson.quiz?.length) return 0;
  let longestCorrect = 0;
  for (const q of lesson.quiz) {
    const max = Math.max(...q.options.map((o) => o.text.length));
    if (q.options.some((o) => o.isCorrect && o.text.length === max)) longestCorrect += 1;
  }
  return longestCorrect / lesson.quiz.length;
}

const files = fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));
let changedLessons = 0;

for (const file of files) {
  const p = path.join(LESSONS_DIR, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let local = false;
  for (const q of data.quiz || []) {
    if (fixQuestion(q)) local = true;
  }
  if (lessonBiasShare(data) > 0.4) {
    for (const q of data.quiz) {
      if (fixQuestion(q)) local = true;
    }
  }
  if (local) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    changedLessons += 1;
  }
}

console.log(`fix-quiz-longest-bias: ${changedLessons} Lektion(en) angepasst.`);
