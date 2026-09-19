import { manifestSchema, type Manifest } from '@futuredev/content-schema';

export const FETCH_TIMEOUT_MS = 10_000;

export type FetchResult =
  | { status: 'ok'; manifest: Manifest }
  | { status: 'offline'; message: string }
  | { status: 'error'; message: string };

/**
 * Holt `manifest.json` mit einem eigenen `AbortController`-Timeout (nie ohne,
 * siehe `feedback_native_fetch_ohne_timeout_haengt_ui`: ein natives fetch
 * ohne Timeout kann die UI unbegrenzt haengen lassen). React Natives `fetch`
 * wertet die `cache`-Option nicht aus (`feedback_rn_fetch_ignoriert_cache_option`);
 * wirksam ist stattdessen der Kopfeintrag `Cache-Control: no-store`, dazu
 * zusaetzlich ein Query-Parameter mit der aktuellen Zeit, damit auch ein CDN
 * ohne Beachtung des Kopfeintrags nie eine alte Fassung liefert.
 */
export async function fetchManifest(
  contentBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${contentBaseUrl.replace(/\/$/, '')}/manifest.json?t=${Date.now()}`;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: 'error', message: `Manifest-Abruf fehlgeschlagen: HTTP ${response.status}` };
    }
    const json: unknown = await response.json();
    const parsed = manifestSchema.safeParse(json);
    if (!parsed.success) {
      return { status: 'error', message: 'Manifest entspricht nicht dem erwarteten Format' };
    }
    return { status: 'ok', manifest: parsed.data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'offline', message: 'Zeitüberschreitung beim Abruf des Manifests' };
    }
    return { status: 'offline', message: 'Kein Netz oder Server nicht erreichbar' };
  } finally {
    clearTimeout(timeout);
  }
}
