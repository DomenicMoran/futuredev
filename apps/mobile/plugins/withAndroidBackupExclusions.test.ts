// @ts-expect-error Node declarations aren't included in the Expo app tsconfig.
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
// @ts-expect-error Node declarations aren't included in the Expo app tsconfig.
import os from 'node:os';
// @ts-expect-error Node declarations aren't included in the Expo app tsconfig.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import withAndroidBackupExclusions from './withAndroidBackupExclusions.js';

interface PluginMods {
  mods: {
    android: {
      manifest: (mod: never) => Promise<{ modResults: { manifest: { application: { $: Record<string, string> }[] } } }>;
      dangerous: (mod: never) => Promise<unknown>;
    };
  };
}

describe('Android automatic backup exclusion config plugin', () => {
  it('disables backup and attaches both Android backup-rule resources to the manifest', async () => {
    const config = withAndroidBackupExclusions({ name: 'FutureDev', slug: 'futuredev', mods: {}, android: {} } as never);
    const modResults = { manifest: { application: [{ $: {} as Record<string, string> }] } };
    const result = await (config as unknown as PluginMods).mods.android.manifest({ ...config, modRequest: {}, modResults } as never);
    const application = result.modResults.manifest.application[0];
    expect(application?.$).toMatchObject({
      'android:allowBackup': 'false',
      'android:fullBackupContent': '@xml/backup_rules',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
  });

  it('writes rules excluding app data from cloud backups and device transfers', async () => {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'futuredev-backup-rules-'));
    try {
      const config = withAndroidBackupExclusions({ name: 'FutureDev', slug: 'futuredev', mods: {}, android: {} } as never);
      await (config as unknown as PluginMods).mods.android.dangerous({ ...config, modRequest: { platformProjectRoot: projectRoot } } as never);
      const xml = path.join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
      const legacy = readFileSync(path.join(xml, 'backup_rules.xml'), 'utf8');
      const extraction = readFileSync(path.join(xml, 'data_extraction_rules.xml'), 'utf8');
      expect(legacy).toContain('<full-backup-content>');
      expect(legacy).toContain('domain="database" path="."');
      expect(extraction).toContain('<cloud-backup>');
      expect(extraction).toContain('<device-transfer>');
      expect(extraction).toContain('<cross-platform-transfer platform="ios">');
      expect(extraction).toContain('domain="database" path="."');
      expect(existsSync(path.join(xml, 'backup_rules.xml'))).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
