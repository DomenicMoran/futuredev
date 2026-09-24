#!/usr/bin/env node
/**
 * Teilt zu lange Sätze in speechBlocks (nach TTS-Merge) an Kommas auf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LESSONS_DIR = path.join(repoRoot, 'content/lessons');

const KNOWN_ABBREVIATIONS = new Set(['bzw', 'usw', 'etc', 'ca', 'ggf', 'evtl', 'vgl', 'inkl', 'nr', 'str']);

function splitSentences(text) {
  const sentences = [];
  let current = '';
  for (const ch of text) {
    current += ch;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    if (ch === '.') {
      const match = /(\S+)\s*$/.exec(current.slice(0, -1));
      const lastWord = (match?.[1] ?? '').replace(/\.$/, '');
      if (/^[A-Za-zÄÖÜäöü]$/.test(lastWord) || KNOWN_ABBREVIATIONS.has(lastWord.toLowerCase())) continue;
    }
    const trimmed = current.trim();
    if (trimmed.length > 0) sentences.push(trimmed);
    current = '';
  }
  const rest = current.trim();
  if (rest.length > 0) sentences.push(rest);
  return sentences;
}

function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
const MAX_WORDS = 35;

function splitLongSentence(sentence) {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= MAX_WORDS) return [sentence.trim()];
  const commaIdx = words.findIndex((w, i) => w.endsWith(',') && i >= 12 && i <= 24);
  if (commaIdx >= 0) {
    const first = words.slice(0, commaIdx + 1).join(' ').replace(/,\s*$/, '.');
    const second = words.slice(commaIdx + 1).join(' ');
    return [first, second.charAt(0).toUpperCase() + second.slice(1)];
  }
  const mid = Math.floor(words.length / 2);
  const first = `${words.slice(0, mid).join(' ')}.`;
  const second = words.slice(mid).join(' ');
  return [first, second.charAt(0).toUpperCase() + second.slice(1)];
}

function fixBlockText(text) {
  const sentences = splitSentences(text);
  const out = [];
  let changed = false;
  for (const s of sentences) {
    if (countWords(s) > MAX_WORDS) {
      out.push(...splitLongSentence(s));
      changed = true;
    } else {
      out.push(s);
    }
  }
  if (!changed) return text;
  return out.join(' ');
}

const files = fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));
let changedFiles = 0;

for (const file of files) {
  const p = path.join(LESSONS_DIR, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let local = false;
  for (const b of data.speechBlocks || []) {
    const next = fixBlockText(b.text);
    if (next !== b.text) {
      b.text = next;
      local = true;
    }
  }
  for (const f of data.faq || []) {
    for (const key of ['question', 'answer']) {
      const next = fixBlockText(f[key]);
      if (next !== f[key]) {
        f[key] = next;
        local = true;
      }
    }
  }
  if (local) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    changedFiles += 1;
  }
}

console.log(`fix-max-sentence-length: ${changedFiles} Lektion(en) angepasst.`);
