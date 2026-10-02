import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export function decodeVerifiedUtf8(bytes: Uint8Array, expectedSha256: string): string {
  const actual = bytesToHex(sha256(bytes));
  if (actual !== expectedSha256) throw new Error('Content SHA-256 mismatch');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const roundTrip = new TextEncoder().encode(text);
  if (roundTrip.length !== bytes.length || roundTrip.some((value, index) => value !== bytes[index])) {
    throw new Error('Content is not byte-stable UTF-8');
  }
  return text;
}

export async function fetchVerifiedFile(url: string, expectedSha256: string, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-store' }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Content fetch failed: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return decodeVerifiedUtf8(bytes, expectedSha256);
  } finally {
    clearTimeout(timeout);
  }
}
