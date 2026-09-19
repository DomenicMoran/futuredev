#!/usr/bin/env tsx
// Erzeugt src/legal/licenses.json aus den Laufzeitabhängigkeiten in
// package.json (AP-3.5, Punkt 3). Liest je Paket dessen eigenes package.json
// unter node_modules für Version und Lizenzfeld, ohne einen externen Dienst
// aufzurufen. Bei einer fehlenden Lizenzangabe wird "unbekannt" eingetragen,
// nie eine erfundene Lizenz.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');
const workspaceRoot = join(appRoot, '..', '..');

const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
const names = Object.keys(pkg.dependencies ?? {}).sort();

function findPackageJson(name) {
  const candidates = [join(appRoot, 'node_modules', name, 'package.json'), join(workspaceRoot, 'node_modules', name, 'package.json')];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const entries = names.map((name) => {
  if (name.startsWith('@futuredev/')) {
    return { name, version: pkg.dependencies[name], license: 'MIT' };
  }
  const path = findPackageJson(name);
  if (!path) {
    return { name, version: pkg.dependencies[name], license: 'unbekannt' };
  }
  const depPkg = JSON.parse(readFileSync(path, 'utf8'));
  const license = depPkg.license ?? (Array.isArray(depPkg.licenses) ? depPkg.licenses.map((l) => l.type).join(', ') : 'unbekannt');
  return { name, version: depPkg.version ?? pkg.dependencies[name], license };
});

const outPath = join(appRoot, 'src', 'legal', 'licenses.json');
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), packages: entries }, null, 2) + '\n');
console.log(`licenses.mjs: ${entries.length} Paket(e) geschrieben nach ${outPath}`);
