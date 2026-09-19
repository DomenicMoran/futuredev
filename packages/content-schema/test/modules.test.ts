import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modulesFileSchema } from '../src/modules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const modulesPath = join(__dirname, '..', '..', '..', 'content', 'modules.json');

describe('modulesFileSchema', () => {
  it('akzeptiert die echte content/modules.json mit genau zehn Modulen', () => {
    const raw = JSON.parse(readFileSync(modulesPath, 'utf8'));
    const result = modulesFileSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modules).toHaveLength(10);
      expect(result.data.modules[0]?.id).toBe('M01');
      expect(result.data.modules[9]?.id).toBe('M10');
    }
  });

  it('lehnt eine Modulkarte mit falscher Kennung ab', () => {
    const result = modulesFileSchema.safeParse({
      modules: [{ id: 'X01', title: 'Falsch', subModules: [{ id: 'M01-01', title: 'a' }] }],
    });
    expect(result.success).toBe(false);
  });
});
