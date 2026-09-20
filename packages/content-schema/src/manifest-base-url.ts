// Reine Logik zur Aufloesung der Basis-URLs fuer content:manifest, getrennt
// von cli-manifest.ts (das Dateisystem und process.exit anfasst), damit
// Vitest sie ohne echten Prozessabbruch pruefen kann. Kein erfundener
// Fallback (Pruefbericht Phase 3, B-01): fehlen Umgebungsvariable und
// Konfigurationsdatei fuer eine der beiden URLs, wirft die Funktion einen
// Fehler statt eine nicht existierende Adresse zurueckzugeben.

export interface ManifestConfig {
  readonly contentBaseUrl?: string;
  readonly audioBaseUrl?: string;
}

export type BaseUrlEnvName = 'CONTENT_BASE_URL' | 'AUDIO_BASE_URL';

export class MissingBaseUrlError extends Error {
  constructor(envName: BaseUrlEnvName) {
    super(
      `${envName} ist weder als Umgebungsvariable noch in content/manifest.config.json gesetzt. ` +
        'Kein erfundener Fallback, Abbruch.',
    );
    this.name = 'MissingBaseUrlError';
  }
}

/**
 * Loest eine Basis-URL auf: Umgebungsvariable geht vor der Konfigurationsdatei.
 * Wirft MissingBaseUrlError, wenn keine der beiden Quellen einen Wert liefert.
 */
export function resolveBaseUrl(
  envName: BaseUrlEnvName,
  env: Record<string, string | undefined>,
  config: ManifestConfig,
): string {
  const fromEnv = env[envName];
  const fromConfig = envName === 'CONTENT_BASE_URL' ? config.contentBaseUrl : config.audioBaseUrl;
  const value = fromEnv ?? fromConfig;
  if (!value) {
    throw new MissingBaseUrlError(envName);
  }
  return value;
}

export interface ResolvedBaseUrls {
  readonly contentBaseUrl: string;
  readonly audioBaseUrl: string;
}

/** Loest beide Basis-URLs auf. Wirft MissingBaseUrlError, wenn eine davon fehlt. */
export function resolveManifestBaseUrls(
  env: Record<string, string | undefined>,
  config: ManifestConfig,
): ResolvedBaseUrls {
  return {
    contentBaseUrl: resolveBaseUrl('CONTENT_BASE_URL', env, config),
    audioBaseUrl: resolveBaseUrl('AUDIO_BASE_URL', env, config),
  };
}
