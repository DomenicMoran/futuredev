// Metro-Konfiguration fuer den pnpm-Workspace. Ohne watchFolders und
// nodeModulesPaths findet Metro die Workspace-Pakete (@futuredev/core und
// andere) nicht, weil sie als TypeScript-Quelle direkt aus packages/*
// verwendet werden. Vorbild: LexiPulse apps/mobile/metro.config.js.
/* eslint-disable @typescript-eslint/no-require-imports -- Metro-Konfigurationen sind CommonJS, kein ESM-Ziel. */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Nur beobachten, was fuer den Bau wirklich gebraucht wird: die gehobenen
// Abhaengigkeiten und die Workspace-Pakete. Nicht die ganze Repo-Wurzel
// (fruehere Fassung: `watchFolders = [workspaceRoot]`), denn das liess
// Metro auch durch `apps/web` (eigenes Next.js mit `.next`), `supabase/`,
// `tools/`, `content/` und den nativen `android/`-Ordner krabbeln. Der
// Crawl brauchte dadurch bis zu 20 Minuten und endete zuletzt mit
// "Failed to get the SHA-1 for: [...]react-native\node_modules\
// @react-native\js-polyfills\console.js" (verwaister, leerer
// node_modules-Rest unter react-native von einem frueheren Installationsstand,
// den der breite Crawl in den Haste-Cache aufnahm), was jeden Bundle-Abruf
// mit HTTP 500 abbrechen liess und die App auf einem schwarzen Bildschirm
// stehen liess (kein Absturz, kein Log: der native Client wartete endlos
// auf eine Antwort, die nie kam).
config.watchFolders = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'packages'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Sicherheitsnetz zusaetzlich zu den engeren watchFolders: falls doch ein
// Pfad aus der Repo-Wurzel in den Graphen gelangt (etwa ueber einen
// Symlink), blockiert diese Liste die schweren, projektfremden Ordner.
// Ueber vollen, mit path.resolve gebauten Pfaden statt bloss "content[\\/]"
// o.ae., damit `apps/mobile/assets/content/` (die gebuendelte Erstkopie,
// die `bundled.generated.ts` importiert) nicht versehentlich mitblockiert
// wird.
function blockPath(...segments) {
  const abs = path.resolve(workspaceRoot, ...segments);
  const escaped = abs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sepTolerant = escaped.replace(/\\\\/g, '[\\\\/]');
  return new RegExp(`^${sepTolerant}[\\\\/].*`);
}

// `content/` NICHT blockieren: `src/settings/profile.ts` importiert von dort
// direkt (`../../../../content/modules.json` u.a.), das JSON ist mit 73 KB
// ohnehin winzig und war beim Crawl nie das Problem. Der eigentliche
// Bremsklotz war `apps/mobile/android/` mit 1,3 GB nativen Bauartefakten
// (`.cxx`, `build/`), das als Teil des standardmaessig beobachteten
// projectRoot mitgelaufen ist (gemessen: `du -sh` je Ordner).
config.resolver.blockList = [
  blockPath('apps', 'web'),
  blockPath('apps', 'mobile', 'android'),
  blockPath('apps', 'mobile', '.expo'),
  blockPath('supabase'),
  blockPath('tools'),
];

config.resolver.unstable_enablePackageExports = true;

// Der Quellcode im ganzen Workspace schreibt relative Importe im
// NodeNext-Stil mit fester ".js"-Endung, auch wenn die Quelle eine
// ".ts"- oder ".tsx"-Datei ist (Konvention aus Phase 2/3, siehe
// packages/*). Metro loest das ohne Zusatzschritt nicht auf, weil es bei
// einer angegebenen Endung keine Alternativen mehr probiert. Dieser Haken
// faengt genau den Fall ab: schlaegt die Anfrage fuer eine relative
// ".js"-Datei fehl, wird dieselbe Anfrage ohne Endung erneut versucht,
// damit Metros eigene sourceExts-Reihenfolge (.tsx, .ts, .jsx, .js, ...)
// greifen kann.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
