#!/usr/bin/env node
/**
 * Repariert TTS-Zeilenumbruch-Artefakte in speechBlocks, FAQ und practiceExample.
 * Aufruf: node tools/fix-tts-breaks.mjs [M01|M02|...|all]
 */
import fs from 'node:fs';
import path from 'node:path';

const LESSONS_DIR = path.resolve('content/lessons');
const ABBREV = new Set(['bzw', 'usw', 'etc', 'ca', 'ggf', 'evtl', 'vgl', 'inkl', 'nr', 'str', 'z']);

function fixTtsText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text.replace(/,\s*\./g, ',').replace(/\.\s+,/g, ',');
  for (let pass = 0; pass < 12; pass += 1) {
    const prev = out;
    out = out.replace(
      /(?<![A-ZÄÖÜ])(?<![\p{L}\p{N}_])([a-zäöüß]{2,})\.\s+([a-zäöüß][\p{L}\p{N}äöüß-]*)/gu,
      (full, before, after) => {
        if (ABBREV.has(before.toLowerCase())) return full;
        return `${before} ${after}`;
      },
    );
    if (out === prev) break;
  }
  return out;
}

function walkStrings(obj, fn) {
  if (typeof obj === 'string') return fn(obj);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      if (typeof obj[i] === 'string') obj[i] = fn(obj[i]);
      else walkStrings(obj[i], fn);
    }
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key === 'id' || key === 'file' || key === 'repoNote' || key === 'location') continue;
      if (typeof obj[key] === 'string') obj[key] = fn(obj[key]);
      else walkStrings(obj[key], fn);
    }
  }
}

const scope = process.argv[2] ?? 'all';
const files = fs
  .readdirSync(LESSONS_DIR)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => {
    if (scope === 'all') return true;
    return f.startsWith(`${scope}-`);
  })
  .sort();

let changedFiles = 0;

for (const file of files) {
  const p = path.join(LESSONS_DIR, file);
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw);
  const before = JSON.stringify(data);
  walkStrings(data, fixTtsText);
  const after = JSON.stringify(data);
  if (before !== after) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    changedFiles += 1;
  }
}

console.log(`fix-tts-breaks: ${files.length} Datei(en) gescannt, ${changedFiles} geändert.`);
