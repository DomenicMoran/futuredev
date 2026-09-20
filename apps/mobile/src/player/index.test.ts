// Prueft die manifest-basierte Audio-Basis-URL (B-01): in der gebauten
// Expo-App ist EXPO_PUBLIC_AUDIO_BASE_URL leer, daher muss die Wiedergabe
// auf die URL im lokal abgelegten Manifest zurueckfallen, statt stumm zu
// bleiben. Die Env-Variable bleibt als Override erhalten.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentFs } from '../content/types.js';
import { resolveAudioBaseUrl } from './index.js';

const CONTENT_DIR = 'file:///doc/content/';

function fakeFs(manifest: string | null): ContentFs {
  return {
    documentDirectory: 'file:///doc/',
    ensureDirectory: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    readFile: vi.fn(async () => {
      if (manifest === null) throw new Error('nicht vorhanden');
      return manifest;
    }),
    exists: vi.fn(async (path: string) => manifest !== null && path === `${CONTENT_DIR}manifest.json`),
    listDirectory: vi.fn(async () => []),
  };
}

const MANIFEST_JSON = JSON.stringify({
  version: '0.1.0',
  contentBaseUrl: 'https://manifest.example/content',
  audioBaseUrl: 'https://manifest.example/audio',
  lessons: [],
});

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_AUDIO_BASE_URL;

afterEach(() => {
  process.env.EXPO_PUBLIC_AUDIO_BASE_URL = ORIGINAL_ENV;
  vi.restoreAllMocks();
});

describe('resolveAudioBaseUrl: Manifest-Fallback (B-01)', () => {
  it('liefert die Manifest-URL, wenn die Env-Variable fehlt', async () => {
    delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
    await expect(resolveAudioBaseUrl(fakeFs(MANIFEST_JSON))).resolves.toBe('https://manifest.example/audio');
  });

  it('bevorzugt die Env-Variable, wenn sie gesetzt ist', async () => {
    process.env.EXPO_PUBLIC_AUDIO_BASE_URL = 'https://env.example/audio';
    await expect(resolveAudioBaseUrl(fakeFs(MANIFEST_JSON))).resolves.toBe('https://env.example/audio');
  });

  it('liefert einen leeren String ohne Manifest und ohne Env-Variable', async () => {
    delete process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
    await expect(resolveAudioBaseUrl(fakeFs(null))).resolves.toBe('');
  });
});
