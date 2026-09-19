// Fuehrt einen Plan gegen einen PublishClient aus (echt oder Attrappe). Reine
// Ablaufsteuerung, keine Argument- oder Dateisystemverarbeitung, damit sie in
// Tests mit einer Attrappe statt eines echten Supabase-Clients laeuft.
import type { Manifest } from '@futuredev/content-schema';
import { sha256Hex } from './hash.js';
import type { AudioPlanStep, ContentPlanStep } from './plan.js';
import type { PublishClient } from './supabase-client.js';

export type ProgressLine = (line: string) => void;

/** Lektionsinhalt (Rohtext, wie er im Repo liegt) je Lektionskennung. */
export type LessonRawById = ReadonlyMap<string, string>;

export async function fetchRemoteManifest(
  client: PublishClient,
  manifestSchema: { safeParse(value: unknown): { success: boolean; data?: Manifest } },
): Promise<Manifest | null> {
  const { data, error } = await client.storage.from('content').download('manifest.json');
  if (error || !data) return null;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(await data.text()));
    return parsed.success && parsed.data ? parsed.data : null;
  } catch {
    return null;
  }
}

async function fetchShaSidecar(client: PublishClient, path: string): Promise<string | undefined> {
  const { data, error } = await client.storage.from('audio').download(path);
  if (error || !data) return undefined;
  return (await data.text()).trim();
}

export async function fetchRemoteAudioShas(
  client: PublishClient,
  lessonIds: readonly string[],
): Promise<{ mp3: Map<string, string>; cues: Map<string, string> }> {
  const mp3 = new Map<string, string>();
  const cues = new Map<string, string>();
  for (const id of lessonIds) {
    const mp3Sha = await fetchShaSidecar(client, `${id}.sha256`);
    if (mp3Sha) mp3.set(id, mp3Sha);
    const cuesSha = await fetchShaSidecar(client, `${id}.cues.sha256`);
    if (cuesSha) cues.set(id, cuesSha);
  }
  return { mp3, cues };
}

export async function executeContentPlan(
  client: PublishClient,
  steps: readonly ContentPlanStep[],
  lessonRawById: LessonRawById,
  publishManifest: Manifest,
  onProgress: ProgressLine,
): Promise<void> {
  for (const step of steps) {
    if (step.kind === 'lesson') {
      const raw = lessonRawById.get(step.id);
      if (raw === undefined) continue;
      const { error } = await client.storage.from('content').upload(step.path, raw, {
        contentType: 'application/json',
        cacheControl: '31536000',
        upsert: true,
      });
      if (error) throw new Error(`Hochladen von ${step.path} fehlgeschlagen: ${error.message}`);
      onProgress(`content: ${step.path} hochgeladen (${step.reason})`);
      continue;
    }
    if (!step.changed) {
      onProgress('content: manifest.json unveraendert, uebersprungen');
      continue;
    }
    const body = `${JSON.stringify(publishManifest, null, 2)}\n`;
    const { error } = await client.storage
      .from('content')
      .upload('manifest.json', body, { contentType: 'application/json', cacheControl: '300', upsert: true });
    if (error) throw new Error(`Hochladen von manifest.json fehlgeschlagen: ${error.message}`);
    onProgress('content: manifest.json hochgeladen');
  }
}

export async function executeAudioPlan(
  client: PublishClient,
  steps: readonly AudioPlanStep[],
  readMp3: (id: string) => Buffer,
  readCues: (id: string) => string,
  onProgress: ProgressLine,
): Promise<void> {
  for (const step of steps) {
    if (step.kind === 'audio-skip') {
      onProgress(`audio: ${step.id} uebersprungen (${step.reason})`);
      continue;
    }
    if (step.kind === 'audio-mp3') {
      const buffer = readMp3(step.id);
      const { error } = await client.storage
        .from('audio')
        .upload(`${step.id}.mp3`, buffer, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: true });
      if (error) throw new Error(`Hochladen von ${step.id}.mp3 fehlgeschlagen: ${error.message}`);
      const sidecar = await client.storage
        .from('audio')
        .upload(`${step.id}.sha256`, sha256Hex(buffer), { contentType: 'text/plain', upsert: true });
      if (sidecar.error) {
        throw new Error(`Sidecar-Pruefsumme fuer ${step.id}.mp3 fehlgeschlagen: ${sidecar.error.message}`);
      }
      onProgress(`audio: ${step.id}.mp3 hochgeladen (${step.reason})`);
      continue;
    }
    const text = readCues(step.id);
    const { error } = await client.storage.from('audio').upload(`${step.id}.cues.json`, text, {
      contentType: 'application/json',
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw new Error(`Hochladen von ${step.id}.cues.json fehlgeschlagen: ${error.message}`);
    const sidecar = await client.storage
      .from('audio')
      .upload(`${step.id}.cues.sha256`, sha256Hex(text), { contentType: 'text/plain', upsert: true });
    if (sidecar.error) {
      throw new Error(`Sidecar-Pruefsumme fuer ${step.id}.cues.json fehlgeschlagen: ${sidecar.error.message}`);
    }
    onProgress(`audio: ${step.id}.cues.json hochgeladen (${step.reason})`);
  }
}

/** Traegt eine Zeile in content_releases ein. checksum ist die Pruefsumme des hochgeladenen Manifest-Textes. */
export async function insertContentRelease(
  client: PublishClient,
  manifest: Manifest,
  manifestUrl: string,
  onProgress: ProgressLine,
): Promise<void> {
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  const checksum = sha256Hex(body);
  const { error } = await client.from('content_releases').insert({
    version: manifest.version,
    manifest_url: manifestUrl,
    checksum,
  });
  if (error) throw new Error(`Eintrag in content_releases fehlgeschlagen: ${error.message}`);
  onProgress(`content_releases: Version ${manifest.version} eingetragen`);
}
