import { describe, expect, it, vi } from 'vitest';
import { deliverExport } from './exportDelivery.js';

function transport(overrides: Partial<Parameters<typeof deliverExport>[1]> = {}): Parameters<typeof deliverExport>[1] {
  return {
    cacheDirectory: 'cache/', writeCache: vi.fn(async () => undefined), isSharingAvailable: vi.fn(async () => true),
    share: vi.fn(async () => undefined), requestDirectory: vi.fn(async () => ({ granted: true, directoryUri: 'external/' })),
    createDestination: vi.fn(async () => 'external/backup.json'), writeDestination: vi.fn(async () => undefined), ...overrides,
  };
}

describe('backup delivery truthful outcomes', () => {
  it('reports shared only after the share operation succeeds', async () => {
    const t = transport();
    await expect(deliverExport('{"safe":true}', t)).resolves.toBe('shared');
    expect(t.share).toHaveBeenCalledWith(expect.stringMatching(/^cache\/futuredev-export-/));
  });
  it('uses user-selected document storage when sharing is unavailable', async () => {
    const t = transport({ isSharingAvailable: async () => false });
    await expect(deliverExport('{}', t)).resolves.toBe('saved');
    expect(t.requestDirectory).toHaveBeenCalledOnce();
    expect(t.writeDestination).toHaveBeenCalledWith('external/backup.json', '{}');
  });
  it('does not treat dismissed sharing or canceled storage selection as backup success', async () => {
    await expect(deliverExport('{}', transport({ share: async () => ({ action: 'dismissedAction' }) }))).resolves.toBe('cancelled');
    await expect(deliverExport('{}', transport({ isSharingAvailable: async () => false, requestDirectory: async () => ({ granted: false }) }))).resolves.toBe('cancelled');
  });
  it('propagates delivery failures rather than claiming a backup exists', async () => {
    await expect(deliverExport('{}', transport({ share: async () => { throw new Error('share failed'); } }))).rejects.toThrow('share failed');
    await expect(deliverExport('{}', transport({ isSharingAvailable: async () => false, writeDestination: async () => { throw new Error('write failed'); } }))).rejects.toThrow('write failed');
  });
});
