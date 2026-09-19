import { describe, expect, it } from 'vitest';
import licenses from './licenses.json';
import pkg from '../../package.json';

// Lizenzliste-Erzeugung (AP-3.5, Punkt 7): scripts/licenses.mjs schreibt
// src/legal/licenses.json aus den Laufzeitabhängigkeiten in package.json
// (`pnpm --filter @futuredev/mobile run licenses`, auch vor jedem
// content:validate/Release-Lauf auszuführen). Dieser Test prüft die zuletzt
// erzeugte Datei gegen die aktuelle package.json, statt die
// Erzeugungslogik zu duplizieren.
describe('src/legal/licenses.json', () => {
  it('enthält genau einen Eintrag je Laufzeitabhängigkeit aus package.json', () => {
    const expectedNames = Object.keys(pkg.dependencies).sort();
    expect(licenses.packages.map((p) => p.name).sort()).toEqual(expectedNames);
  });

  it('nennt für jedes Paket eine nicht leere Lizenz, MIT für die eigenen @futuredev-Pakete', () => {
    expect(licenses.packages.every((p) => typeof p.license === 'string' && p.license.length > 0)).toBe(true);
    const ownPackages = licenses.packages.filter((p) => p.name.startsWith('@futuredev/'));
    expect(ownPackages.length).toBeGreaterThan(0);
    expect(ownPackages.every((p) => p.license === 'MIT')).toBe(true);
  });
});
