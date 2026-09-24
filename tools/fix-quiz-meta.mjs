#!/usr/bin/env node
/** Entfernt Platzhalter-Ablenker und balanciert Optionlängen heuristisch. */
import fs from 'node:fs';
import path from 'node:path';

const LESSONS_DIR = path.resolve('content/lessons');
const META_RE = /\s*\(häufige Verwechslung in diesem Themenfeld\)/gi;
const PAD_RE =
  /\s*Das trifft auf den Kern dieser Frage nicht zu, auch wenn es in anderen Kontexten plausibel klingen kann\./g;

function stripMeta(text) {
  return text.replace(META_RE, '').replace(PAD_RE, '').trim();
}

const files = fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));
let lessonsChanged = 0;
let optionsFixed = 0;

for (const file of files) {
  const p = path.join(LESSONS_DIR, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let local = 0;
  for (const q of data.quiz || []) {
    const before = JSON.stringify(q.options);
    for (const o of q.options) {
      const stripped = stripMeta(o.text);
      if (stripped !== o.text) o.text = stripped;
    }
    const after = JSON.stringify(q.options);
    if (before !== after) local += 1;
  }
  if (local > 0) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    lessonsChanged += 1;
    optionsFixed += local;
  }
}

console.log(`fix-quiz-meta: ${optionsFixed} Frage(n) in ${lessonsChanged} Lektion(en) angepasst.`);
