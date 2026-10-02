import { cueSheetSchema, type CueSheet, type Lesson } from '@futuredev/content-schema';

export interface DownloadPackageMarker {
  readonly version: 1;
  readonly lessonId: string;
  readonly generation: string;
  readonly audioFile: string;
  readonly audioBytes: number;
  readonly audioPrefix: string;
  readonly cuesFile: string;
  readonly cuesBytes: number;
  readonly cuesChecksum: string;
}

/** A compact accidental-corruption checksum; it is not a publisher-authentication hash. */
export function checksumCueText(text: string): string {
  let value = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    value ^= BigInt(byte);
    value = BigInt.asUintN(64, value * 0x100000001b3n);
  }
  return value.toString(16).padStart(16, '0');
}

export function validateCueText(text: string, lesson: Lesson): CueSheet {
  let json: unknown;
  try { json = JSON.parse(text) as unknown; } catch { throw new Error('Cue-Datei ist kein gültiges JSON'); }
  const parsed = cueSheetSchema.safeParse(json);
  if (!parsed.success || parsed.data.lessonId !== lesson.id) throw new Error('Cue-Datei passt nicht zur Lektion');
  if (parsed.data.blocks.length !== lesson.speechBlocks.length) throw new Error('Cue-Anzahl passt nicht zur Lektion');
  let previousEnd = 0;
  for (let index = 0; index < parsed.data.blocks.length; index += 1) {
    const block = parsed.data.blocks[index];
    if (!block || block.index !== index || block.startSeconds < previousEnd - 0.01) throw new Error('Cue-Reihenfolge oder Zeitangabe ungültig');
    previousEnd = block.startSeconds + block.durationSeconds;
  }
  if (previousEnd > lesson.audio.durationSeconds + 3) throw new Error('Cue-Dauer überschreitet Audiodauer');
  return parsed.data;
}

export function isPlausibleMp3Prefix(base64: string): boolean {
  let decoded: string;
  try { decoded = atob(base64); } catch { return false; }
  const bytes = Uint8Array.from(decoded, (value) => value.charCodeAt(0));
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  for (let index = 0; index < Math.min(bytes.length - 1, 64); index += 1) {
    const nextByte = bytes[index + 1];
    if (bytes[index] === 0xff && nextByte !== undefined && (nextByte & 0xe0) === 0xe0) return true;
  }
  return false;
}

export function parseDownloadPackageMarker(raw: string, lessonId: string): DownloadPackageMarker | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const marker = value as Partial<DownloadPackageMarker>;
    if (marker.version !== 1 || marker.lessonId !== lessonId || typeof marker.generation !== 'string' ||
      !/^[0-9a-f]{8,32}$/.test(marker.generation) || typeof marker.audioFile !== 'string' ||
      typeof marker.cuesFile !== 'string' || marker.audioBytes === undefined || typeof marker.audioBytes !== 'number' || marker.audioBytes < 1024 ||
      typeof marker.cuesBytes !== 'number' || marker.cuesBytes < 2 || typeof marker.audioPrefix !== 'string' ||
      typeof marker.cuesChecksum !== 'string' || !/^[0-9a-f]{16}$/.test(marker.cuesChecksum)) return null;
    if (marker.audioFile !== `${lessonId}.${marker.generation}.mp3` || marker.cuesFile !== `${lessonId}.${marker.generation}.cues.json`) return null;
    return marker as DownloadPackageMarker;
  } catch { return null; }
}
