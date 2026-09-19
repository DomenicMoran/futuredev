// Liest .env.local aus der Repo-Wurzel. Gleiches Muster wie
// tools/audio/src/render-lesson.ts (kein dotenv-Paket noetig, manuelles
// Parsen reicht und bleibt konsistent mit dem Rest des Repos). Gibt nie einen
// Wert aus, auch nicht in einer Fehlermeldung: nur der Variablenname erscheint.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SupabaseEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

export function readEnvLocal(repoRoot: string): Record<string, string> {
  const path = join(repoRoot, '.env.local');
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#') || !line.includes('=')) continue;
    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

/**
 * Liefert SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY, oder null, wenn der
 * Dienstschluessel fehlt (Umgebungsvariable geht vor Datei, wie bei
 * render-lesson.ts). Ohne Dienstschluessel ist kein Upload moeglich, siehe
 * tools/publish/README.md fuer den Weg ueber den Hauptagenten (MCP).
 */
export function loadSupabaseEnv(repoRoot: string): SupabaseEnv | null {
  const fromFile = readEnvLocal(repoRoot);
  const get = (name: string): string | undefined => process.env[name] ?? fromFile[name];
  const url = get('SUPABASE_URL');
  const key = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key };
}

/**
 * `SUPABASE_URL` allein, unabhaengig vom Dienstschluessel: die Basis-URLs im
 * veroeffentlichten Manifest muessen auch im Dry-Run ohne
 * `SUPABASE_SERVICE_ROLE_KEY` auf den Supabase-Eimer zeigen, nicht auf
 * GitHub (siehe `buildPublishManifest` in plan.ts). Nicht gefunden ist ein
 * Abbruch, kein stiller Rueckfall, weil sonst ein Manifest mit falscher
 * Basis-URL veroeffentlicht werden koennte.
 */
export function loadSupabaseUrl(repoRoot: string): string | null {
  const fromFile = readEnvLocal(repoRoot);
  return process.env.SUPABASE_URL ?? fromFile.SUPABASE_URL ?? null;
}
