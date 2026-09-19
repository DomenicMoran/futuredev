// Automatisch erzeugt von apps/mobile/scripts/bundle-content.mjs. Nicht von
// Hand bearbeiten, Aenderungen gehen beim naechsten Lauf verloren.
//
// Enthaelt die zum Zeitpunkt des Laufs veroeffentlichten Lektionen als
// gebuendelte Erststart-Kopie (Technikvorgabe 4: "Erststart: gebuendelte
// Kopie"). `src/content/bundledContent.ts` kopiert daraus ins
// Dokumentverzeichnis, wenn dort noch nichts liegt.
import manifest from './manifest.json';
import modules from './modules.json';
import lesson0 from './lessons/M01-01-01.json';

export const bundledManifest = manifest;
export const bundledModules = modules;
export const bundledLessons: Record<string, unknown> = {
  'M01-01-01': lesson0,
};
