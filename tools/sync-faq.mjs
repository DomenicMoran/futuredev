#!/usr/bin/env node
/**
 * Sync faq[] text with role:faq speechBlocks (and vice versa), then rebuild.
 * Also shorten faq answers with the same sentence splitter.
 * Run: node tools/sync-faq.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('content/lessons');
const MAX = 18;


function splitLong(sentence) {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= MAX) return [sentence.trim()];
  const chunks = [];
  for (let i = 0; i < words.length; i += MAX) {
    let chunk = words.slice(i, i + MAX).join(' ');
    if (!/[.!?]$/.test(chunk)) chunk += '.';
    chunks.push(chunk);
  }
  return chunks;
}

function shorten(text) {
  const out = [];
  let current = '';
  for (const ch of text || '') {
    current += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      const t = current.trim();
      if (t) out.push(...splitLong(t));
      current = '';
    }
  }
  const rest = current.trim();
  if (rest) out.push(...splitLong(rest));
  return out.join(' ');
}

let n = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const p = path.join(DIR, f);
  const l = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(l.speechBlocks) || !Array.isArray(l.faq)) continue;

  // Prefer faq field as source of truth; shorten both sides identically
  for (const entry of l.faq) {
    entry.question = shorten(entry.question);
    entry.answer = shorten(entry.answer);
  }

  const withoutFaq = l.speechBlocks.filter((b) => b.role !== 'faq');
  const faqBlocks = [];
  for (const entry of l.faq) {
    faqBlocks.push({
      speaker: 'B',
      role: 'faq',
      text: entry.question,
      isKeySentence: false,
    });
    faqBlocks.push({
      speaker: 'A',
      role: 'faq',
      text: entry.answer,
      isKeySentence: false,
    });
  }
  l.speechBlocks = [...withoutFaq, ...faqBlocks];
  fs.writeFileSync(p, JSON.stringify(l, null, 2) + '\n', 'utf8');
  n += 1;
}
console.log(`synced faq in ${n} lessons`);
