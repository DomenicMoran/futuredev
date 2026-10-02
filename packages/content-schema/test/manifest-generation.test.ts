import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeValidLesson } from './fixtures.js';
import { buildManifest, compareSemver, sha256Bytes } from '../src/manifest-generation.js';

function validModules() {
  return { modules: Array.from({ length: 10 }, (_, index) => {
    const id = `M${String(index + 1).padStart(2, '0')}`;
    return { id, title: `Modul ${id}`, subModules: [{ id: `${id}-01`, title: 'Abschnitt' }] };
  }) };
}

describe('complete manifest generation', () => {
  it('hashes exact UTF-8 source bytes, includes a module digest, and rejects partial/unsafe inputs', () => {
    const rawModules = new TextEncoder().encode(`${JSON.stringify(validModules(), null, 2)}\n`);
    const rawLesson = new TextEncoder().encode(`${JSON.stringify(makeValidLesson(), null, 2)}\n`);
    const result = buildManifest({
      version: '0.6.0', contentBaseUrl: 'https://example.test/content', audioBaseUrl: 'https://example.test/audio',
      rawModules, lessons: [{ file: 'M01-01-01.json', bytes: rawLesson, updatedAt: '2026-09-25T00:00:00Z' }],
    });
    expect(result.version).toBe('0.6.0');
    expect(result.modulesSha256).toBe(createHash('sha256').update(rawModules).digest('hex'));
    expect(result.lessons[0]?.sha256).toBe(sha256Bytes(rawLesson));
    expect(result.lessons[0]?.sha256).not.toBe(createHash('sha256').update(JSON.stringify(makeValidLesson())).digest('hex'));
    expect(() => buildManifest({ version: '0.6.0', contentBaseUrl: 'https://example.test', audioBaseUrl: 'https://example.test', rawModules, lessons: [] })).toThrow('empty content release');
    expect(() => buildManifest({ version: '0.6.0', contentBaseUrl: 'https://example.test', audioBaseUrl: 'https://example.test', rawModules, lessons: [{ file: '../M01-01-01.json', bytes: rawLesson, updatedAt: '2026-09-25T00:00:00Z' }] })).toThrow('Unsafe content filename');
    const missingPrerequisite = makeValidLesson();
    missingPrerequisite.prerequisites = ['M02-01-01'];
    expect(() => buildManifest({ version: '0.6.0', contentBaseUrl: 'https://example.test', audioBaseUrl: 'https://example.test', rawModules, lessons: [{ file: 'M01-01-01.json', bytes: new TextEncoder().encode(JSON.stringify(missingPrerequisite)), updatedAt: '2026-09-25T00:00:00Z' }] })).toThrow('Missing prerequisite');
    const incompleteModules = validModules();
    incompleteModules.modules = incompleteModules.modules.map((module, index) => index === 9 ? { ...module, id: 'M01' } : module);
    expect(() => buildManifest({ version: '0.6.0', contentBaseUrl: 'https://example.test', audioBaseUrl: 'https://example.test', rawModules: new TextEncoder().encode(JSON.stringify(incompleteModules)), lessons: [{ file: 'M01-01-01.json', bytes: rawLesson, updatedAt: '2026-09-25T00:00:00Z' }] })).toThrow('modules.json does not match modulesFileSchema');
  });

  it('compares semantic versions numerically', () => {
    expect(compareSemver('0.10.0', '0.6.0')).toBe(1);
    expect(compareSemver('0.5.99', '0.6.0')).toBe(-1);
    expect(compareSemver('0.6.0', '0.6.0')).toBe(0);
  });
});
