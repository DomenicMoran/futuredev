import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/publish.js';

const repoRoot = resolve('C:/repo');

describe('parseArgs', () => {
  it('erkennt --dry-run', () => {
    expect(parseArgs(['--dry-run'], repoRoot).dryRun).toBe(true);
    expect(parseArgs([], repoRoot).dryRun).toBe(false);
  });

  it('setzt den Standard-Audio-Ordner auf tools/audio/out unter der Repo-Wurzel', () => {
    expect(parseArgs([], repoRoot).audioDir).toBe(join(repoRoot, 'tools', 'audio', 'out'));
  });

  it('loest --audio-dir relativ zur Repo-Wurzel auf', () => {
    expect(parseArgs(['--audio-dir', 'anderer/ordner'], repoRoot).audioDir).toBe(
      resolve(repoRoot, 'anderer/ordner'),
    );
  });
});
