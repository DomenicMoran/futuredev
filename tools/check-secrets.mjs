#!/usr/bin/env node
// Prüft gestagte (oder mit --all: alle versionierten) Dateien auf Schlüsselmuster,
// bevor sie in einen Commit gelangen. Gibt nie den Fundtext aus, nur Datei und
// Zeilennummer. Rückgabewert 1 bei Fund, 0 sonst.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Muster aus Entscheidung 12 des Zusatzauftrags Phase 2.
const SECRET_PATTERNS = [
  { name: 'OpenAI-artiger Schlüssel', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'Stripe live secret key', re: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'JWT / langer Base64-Block', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'GitHub personal access token', re: /\bghp_[A-Za-z0-9]{30,}\b/ },
  { name: 'ElevenLabs API key', re: /\bxi-api-key\s*[:=]\s*\S+/i },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
];

// Dateinamen, die grundsätzlich nicht ins Repo gehören, unabhängig vom Inhalt.
const FORBIDDEN_NAME_PATTERNS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[^/]+$/,
  /\.jks$/i,
  /\.keystore$/i,
  /\.p8$/i,
  /\.p12$/i,
];

const allowedEnvException = (path) => path.endsWith('.env.example');

function listCandidateFiles(all) {
  if (all) {
    const out = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  }
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

function checkFile(path) {
  const findings = [];

  for (const pattern of FORBIDDEN_NAME_PATTERNS) {
    if (pattern.test(path) && !allowedEnvException(path)) {
      findings.push({ path, line: 0, rule: `verbotener Dateiname (${pattern})` });
    }
  }

  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    // Datei gelöscht oder binär unlesbar als Text: Namensprüfung reicht.
    return findings;
  }

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(line)) {
        findings.push({ path, line: index + 1, rule: name });
      }
    }
  });

  return findings;
}

function main() {
  const all = process.argv.includes('--all');
  const files = listCandidateFiles(all);
  let findings = [];

  for (const file of files) {
    findings = findings.concat(checkFile(file));
  }

  if (findings.length > 0) {
    console.error('Schutz vor dem ersten Commit: Fund gegen die Schlüsselmuster.');
    for (const f of findings) {
      console.error(`  ${f.path}:${f.line}, Regel: ${f.rule}`);
    }
    console.error(`${findings.length} Fund(e). Commit abgebrochen.`);
    process.exit(1);
  }

  console.log(`check-secrets: ${files.length} Datei(en) geprüft, kein Fund.`);
  process.exit(0);
}

main();
