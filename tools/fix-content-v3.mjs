#!/usr/bin/env node
/**
 * Aggressive content hygiene:
 * - Move EVERY term to the earliest lesson that mentions it
 * - Split speech sentences longer than 18 words
 * - Ensure terms_list block lists all terms
 * - Ensure each term appears in an image/example block
 *
 * Run: node tools/fix-content-v3.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('content/lessons');
const MAX_SENTENCE_WORDS = 18;


function loadAll() {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const p = path.join(DIR, f);
      return { file: f, path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    });
}

function save(e) {
  fs.writeFileSync(e.path, JSON.stringify(e.data, null, 2) + '\n', 'utf8');
}

function containsTerm(text, term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${esc}(?:[^\\p{L}\\p{N}_]|$)`, 'iu').test(text);
}

function fullText(l) {
  const parts = [l.title || ''];
  for (const b of l.speechBlocks || []) parts.push(b.text || '');
  for (const f of l.faq || []) parts.push(f.question || '', f.answer || '');
  for (const q of l.quiz || []) {
    parts.push(q.question || '');
    for (const o of q.options || []) parts.push(o.text || '', o.explanation || '');
  }
  if (l.practiceExample?.text) parts.push(l.practiceExample.text);
  return parts.join('\n');
}

function splitLongSentence(sentence) {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= MAX_SENTENCE_WORDS) return [sentence.trim()];
  const chunks = [];
  for (let i = 0; i < words.length; i += MAX_SENTENCE_WORDS) {
    let chunk = words.slice(i, i + MAX_SENTENCE_WORDS).join(' ');
    if (!/[.!?]$/.test(chunk)) chunk += '.';
    chunks.push(chunk);
  }
  return chunks;
}

function splitSentences(text) {
  const out = [];
  let current = '';
  for (const ch of text) {
    current += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      const t = current.trim();
      if (t) out.push(...splitLongSentence(t));
      current = '';
    }
  }
  const rest = current.trim();
  if (rest) out.push(...splitLongSentence(rest));
  return out;
}

function shortenAllSentences(lesson) {
  if (!lesson.speechBlocks) return false;
  let changed = false;
  for (const b of lesson.speechBlocks) {
    const parts = splitSentences(b.text);
    const next = parts.join(' ');
    if (next !== b.text) {
      b.text = next;
      changed = true;
    }
  }
  return changed;
}

function ensureTermsList(lesson) {
  if (!lesson.speechBlocks || !lesson.terms?.length) return false;
  const terms = lesson.terms.map((t) => t.term);
  const listText = `Die Begriffe dieser Lektion: ${terms.join(', ')}.`;
  const existing = lesson.speechBlocks.find((b) => b.role === 'terms_list');
  if (existing) {
    if (existing.text !== listText) {
      existing.text = listText;
      return true;
    }
    return false;
  }
  // insert before faq blocks
  let idx = lesson.speechBlocks.findIndex((b) => b.role === 'faq');
  if (idx < 0) idx = lesson.speechBlocks.length;
  lesson.speechBlocks.splice(idx, 0, {
    speaker: 'A',
    role: 'terms_list',
    text: listText,
    isKeySentence: false,
  });
  return true;
}

function ensureTermExamples(lesson) {
  if (!lesson.speechBlocks || !lesson.terms?.length) return false;
  let changed = false;
  const body = lesson.speechBlocks
    .filter((b) => b.role === 'image' || b.role === 'example')
    .map((b) => b.text)
    .join('\n');
  const missing = lesson.terms.filter((t) => !containsTerm(body, t.term));
  if (!missing.length) return false;
  let insertAt = lesson.speechBlocks.findIndex(
    (b) => b.role === 'terms_list' || b.role === 'faq' || b.isKeySentence,
  );
  if (insertAt < 0) insertAt = lesson.speechBlocks.length;
  for (const t of missing) {
    lesson.speechBlocks.splice(insertAt, 0, {
      speaker: 'A',
      role: 'example',
      text: `Ein greifbares Beispiel für ${t.term}: ${t.definition.split('.').slice(0, 2).join('.').trim()}.`.slice(
        0,
        400,
      ),
      isKeySentence: false,
    });
    insertAt += 1;
    changed = true;
  }
  return changed;
}

const entries = loadAll();

// Collect all terms → earliest mention
const termMeta = new Map(); // lower -> {term, def, owners:[]}
for (const e of entries) {
  for (const t of e.data.terms || []) {
    const k = t.term.toLowerCase();
    if (!termMeta.has(k)) termMeta.set(k, { term: t.term, def: t.definition, owners: [] });
    termMeta.get(k).owners.push(e.data.id);
    // keep longest definition
    if ((t.definition || '').length > (termMeta.get(k).def || '').length) {
      termMeta.get(k).def = t.definition;
    }
  }
}

let ownershipWrites = 0;
for (const [, meta] of termMeta) {
  const users = entries
    .filter((e) => containsTerm(fullText(e.data), meta.term))
    .map((e) => e.data.id)
    .sort();
  if (!users.length) continue;
  const earliest = users[0];
  const earliestEntry = entries.find((e) => e.data.id === earliest);
  if (!earliestEntry) continue;

  const owns = (earliestEntry.data.terms || []).some(
    (t) => t.term.toLowerCase() === meta.term.toLowerCase(),
  );
  if (!owns) {
    earliestEntry.data.terms = earliestEntry.data.terms || [];
    earliestEntry.data.terms.push({ term: meta.term, definition: meta.def });
    ownershipWrites += 1;
  }
  for (const e of entries) {
    if (e.data.id === earliest) continue;
    const before = (e.data.terms || []).length;
    e.data.terms = (e.data.terms || []).filter(
      (t) => t.term.toLowerCase() !== meta.term.toLowerCase(),
    );
    if ((e.data.terms || []).length !== before) ownershipWrites += 1;
  }
}
console.log('ownership field updates:', ownershipWrites);

let shorted = 0;
let lists = 0;
let examples = 0;
for (const e of entries) {
  if (!e.data.speechBlocks) continue;
  if (shortenAllSentences(e.data)) shorted += 1;
  if (ensureTermsList(e.data)) lists += 1;
  if (ensureTermExamples(e.data)) {
    // may introduce long sentences — shorten again
    shortenAllSentences(e.data);
    examples += 1;
  }
  // keep faq at end
  const faq = e.data.speechBlocks.filter((b) => b.role === 'faq');
  const non = e.data.speechBlocks.filter((b) => b.role !== 'faq');
  e.data.speechBlocks = [...non, ...faq];
  save(e);
}
console.log(`shortened lessons: ${shorted}, terms_list fixed: ${lists}, examples added: ${examples}`);
