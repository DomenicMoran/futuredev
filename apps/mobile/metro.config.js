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

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
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
