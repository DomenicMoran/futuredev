import { describe, expect, it } from 'vitest';
import type { Manifest } from '@futuredev/content-schema';
import {
  executeAudioPlan,
  executeContentPlan,
  fetchRemoteAudioShas,
  fetchRemoteManifest,
  insertContentRelease,
} from '../src/supabase-ops.js';
import type { PublishClient, StorageError } from '../src/supabase-client.js';
import { sha256Hex } from '../src/hash.js';

/** Attrappe statt eines echten Supabase-Clients: haelt hochgeladene Objekte im Speicher. */
function fakeClient(seed: { content?: Record<string, string>; audio?: Record<string, string> } = {}) {
  const buckets: Record<'content' | 'audio', Map<string, string>> = {
    content: new Map(Object.entries(seed.content ?? {})),
    audio: new Map(Object.entries(seed.audio ?? {})),
  };
  const inserts: Record<string, unknown>[] = [];
  const uploads: { bucket: 'content' | 'audio'; path: string; contentType: string; cacheControl: string | undefined }[] = [];

  const client: PublishClient = {
    storage: {
      from(bucket: 'content' | 'audio') {
        return {
          async upload(path, body, options) {
            uploads.push({ bucket, path, contentType: options.contentType, cacheControl: options.cacheControl });
            buckets[bucket].set(path, typeof body === 'string' ? body : body.toString('utf8'));
            return { error: null };
          },
          async download(path) {
            const value = buckets[bucket].get(path);
            if (value === undefined) return { data: null, error: { message: 'not found' } as StorageError };
            return { data: { text: async () => value }, error: null };
          },
        };
      },
    },
    from(table: 'content_releases') {
      void table;
      return {
        async insert(row) {
          inserts.push(row);
          return { error: null };
        },
      };
    },
  };

  return { client, buckets, inserts, uploads };
}

const manifestSchemaLike = {
  safeParse(value: unknown) {
    return { success: true, data: value as Manifest };
  },
};

describe('fetchRemoteManifest', () => {
  it('gibt null zurueck, wenn im Eimer noch kein Manifest liegt', async () => {
    const { client } = fakeClient();
    expect(await fetchRemoteManifest(client, manifestSchemaLike)).toBeNull();
  });

  it('liest und parst ein vorhandenes Manifest', async () => {
    const manifest: Manifest = { version: '0.1.0', contentBaseUrl: 'https://x/content', audioBaseUrl: 'https://x/audio', lessons: [] };
    const { client } = fakeClient({ content: { 'manifest.json': JSON.stringify(manifest) } });
    expect(await fetchRemoteManifest(client, manifestSchemaLike)).toEqual(manifest);
  });
});

describe('fetchRemoteAudioShas', () => {
  it('liest die Sidecar-Pruefsummen je Lektion, laesst fehlende aus', async () => {
    const { client } = fakeClient({ audio: { 'M01-01-01.sha256': 'abc', 'M01-01-01.cues.sha256': 'def' } });
    const result = await fetchRemoteAudioShas(client, ['M01-01-01', 'M01-01-02']);
    expect(result.mp3.get('M01-01-01')).toBe('abc');
    expect(result.cues.get('M01-01-01')).toBe('def');
    expect(result.mp3.has('M01-01-02')).toBe(false);
  });
});

describe('executeContentPlan', () => {
  it('laedt Lektionen mit einjaehrigem Cache und das Manifest mit 300s hoch, in der geplanten Reihenfolge', async () => {
    const { client, uploads, buckets } = fakeClient();
    const publishManifest: Manifest = { version: '0.1.0', contentBaseUrl: 'https://x/content', audioBaseUrl: 'https://x/audio', lessons: [] };
    const lessonRawById = new Map([['M01-01-01', '{"id":"M01-01-01"}']]);
    const lines: string[] = [];

    await executeContentPlan(
      client,
      [
        { kind: 'lesson', id: 'M01-01-01', path: 'lessons/M01-01-01.abc123456789.json', reason: 'neu' },
        { kind: 'manifest', changed: true },
      ],
      lessonRawById,
      publishManifest,
      (line) => lines.push(line),
    );

    expect(uploads.map((u) => u.path)).toEqual(['lessons/M01-01-01.abc123456789.json', 'manifest.json']);
    expect(uploads[0]?.cacheControl).toBe('31536000');
    expect(uploads[1]?.cacheControl).toBe('300');
    expect(buckets.content.get('manifest.json')).toContain('"version": "0.1.0"');
    expect(lines).toEqual([
      'content: lessons/M01-01-01.abc123456789.json hochgeladen (neu)',
      'content: manifest.json hochgeladen',
    ]);
  });

  it('laedt das Manifest nicht hoch, wenn der Schritt "unveraendert" ist', async () => {
    const { client, uploads } = fakeClient();
    const publishManifest: Manifest = { version: '0.1.0', contentBaseUrl: 'https://x/content', audioBaseUrl: 'https://x/audio', lessons: [] };
    const lines: string[] = [];

    await executeContentPlan(client, [{ kind: 'manifest', changed: false }], new Map(), publishManifest, (line) => lines.push(line));

    expect(uploads).toEqual([]);
    expect(lines).toEqual(['content: manifest.json unveraendert, uebersprungen']);
  });
});

describe('executeAudioPlan', () => {
  it('laedt MP3 und Cue-Datei samt Sidecar-Pruefsummen hoch und ueberspringt gemeldete Lektionen', async () => {
    const { client, uploads, buckets } = fakeClient();
    const mp3 = Buffer.from('fake-mp3-bytes');
    const cues = '{"cues":[]}';
    const lines: string[] = [];

    await executeAudioPlan(
      client,
      [
        { kind: 'audio-mp3', id: 'M01-01-01', reason: 'neu' },
        { kind: 'audio-cues', id: 'M01-01-01', reason: 'neu' },
        { kind: 'audio-skip', id: 'M01-01-02', reason: 'keine MP3 im Audio-Ordner gefunden' },
      ],
      () => mp3,
      () => cues,
      (line) => lines.push(line),
    );

    expect(uploads.map((u) => u.path)).toEqual(['M01-01-01.mp3', 'M01-01-01.sha256', 'M01-01-01.cues.json', 'M01-01-01.cues.sha256']);
    expect(buckets.audio.get('M01-01-01.sha256')).toBe(sha256Hex(mp3));
    expect(buckets.audio.get('M01-01-01.cues.sha256')).toBe(sha256Hex(cues));
    expect(lines).toEqual([
      'audio: M01-01-01.mp3 hochgeladen (neu)',
      'audio: M01-01-01.cues.json hochgeladen (neu)',
      'audio: M01-01-02 uebersprungen (keine MP3 im Audio-Ordner gefunden)',
    ]);
  });
});

describe('insertContentRelease', () => {
  it('traegt Version, Manifest-URL und Pruefsumme ein', async () => {
    const { client, inserts } = fakeClient();
    const manifest: Manifest = { version: '0.2.0', contentBaseUrl: 'https://x/content', audioBaseUrl: 'https://x/audio', lessons: [] };
    const lines: string[] = [];

    await insertContentRelease(client, manifest, 'https://x/content/manifest.json', (line) => lines.push(line));

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ version: '0.2.0', manifest_url: 'https://x/content/manifest.json' });
    expect(typeof (inserts[0] as { checksum: string }).checksum).toBe('string');
    expect((inserts[0] as { checksum: string }).checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(lines).toEqual(['content_releases: Version 0.2.0 eingetragen']);
  });
});
