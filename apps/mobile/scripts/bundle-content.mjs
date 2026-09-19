#!/usr/bin/env node
// Kopiert content/manifest.json, content/modules.json und content/lessons/*.json
// nach apps/mobile/assets/content/ und erzeugt eine statische Importdatei
// (bundled.generated.ts). Laeuft als "prestart"/"pretest"-Skript vor
// `expo start` und vor `vitest run` (siehe package.json), sowie von Hand vor
// einem nativen Bau (`gradlew assembleDebug`). Metro (und Vitest/Node) loesen
// keinen dynamischen `require(pfad)`-Aufruf auf, deshalb erzeugt dieses
// Skript feste `import`-Anweisungen, eine je Lektion aus dem Manifest.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const repoRoot = path.resolve(mobileRoot, '../..');
const contentDir = path.join(repoRoot, 'content');
const assetsDir = path.join(mobileRoot, 'assets', 'content');
const lessonsOutDir = path.join(assetsDir, 'lessons');

if (existsSync(lessonsOutDir)) {
  rmSync(lessonsOutDir, { recursive: true, force: true });
}
mkdirSync(lessonsOutDir, { recursive: true });

copyFileSync(path.join(contentDir, 'manifest.json'), path.join(assetsDir, 'manifest.json'));
copyFileSync(path.join(contentDir, 'modules.json'), path.join(assetsDir, 'modules.json'));

const manifest = JSON.parse(readFileSync(path.join(contentDir, 'manifest.json'), 'utf8'));

const importLines = [];
const mapLines = [];
manifest.lessons.forEach((entry, index) => {
  const src = path.join(contentDir, 'lessons', entry.file);
  const dest = path.join(lessonsOutDir, entry.file);
  copyFileSync(src, dest);
  const varName = `lesson${index}`;
  importLines.push(`import ${varName} from './lessons/${entry.file}';`);
  mapLines.push(`  '${entry.id}': ${varName},`);
});

const generated = `// Automatisch erzeugt von apps/mobile/scripts/bundle-content.mjs. Nicht von
// Hand bearbeiten, Aenderungen gehen beim naechsten Lauf verloren.
//
// Enthaelt die zum Zeitpunkt des Laufs veroeffentlichten Lektionen als
// gebuendelte Erststart-Kopie (Technikvorgabe 4: "Erststart: gebuendelte
// Kopie"). \`src/content/bundledContent.ts\` kopiert daraus ins
// Dokumentverzeichnis, wenn dort noch nichts liegt.
import manifest from './manifest.json';
import modules from './modules.json';
${importLines.join('\n')}

export const bundledManifest = manifest;
export const bundledModules = modules;
export const bundledLessons: Record<string, unknown> = {
${mapLines.join('\n')}
};
`;

writeFileSync(path.join(assetsDir, 'bundled.generated.ts'), generated, 'utf8');

console.log(`bundle-content: ${manifest.lessons.length} Lektion(en) nach ${path.relative(mobileRoot, assetsDir)} kopiert.`);
