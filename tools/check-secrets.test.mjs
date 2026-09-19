// Simuliert einen Fund und erwartet Rückgabewert 1. Kein echter Schlüssel im Test,
// nur das Muster (sk- gefolgt von 40 mal x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('check-secrets bricht bei einem Musterfund mit Rückgabewert 1 ab', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-secrets-test-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });

    const fakeSecret = 'sk-' + 'x'.repeat(40);
    writeFileSync(join(dir, 'leak.txt'), `TOKEN=${fakeSecret}\n`);
    execFileSync('git', ['add', 'leak.txt'], { cwd: dir });

    const scriptPath = join(import.meta.dirname, 'check-secrets.mjs');
    assert.throws(() => {
      execFileSync('node', [scriptPath], { cwd: dir, stdio: 'pipe' });
    }, /Command failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check-secrets meldet Erfolg ohne Fund', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-secrets-test-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });

    writeFileSync(join(dir, 'harmless.txt'), 'hallo welt\n');
    execFileSync('git', ['add', 'harmless.txt'], { cwd: dir });

    const scriptPath = join(import.meta.dirname, 'check-secrets.mjs');
    const out = execFileSync('node', [scriptPath], { cwd: dir, encoding: 'utf8' });
    assert.match(out, /kein Fund/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
