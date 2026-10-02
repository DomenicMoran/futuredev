// Prüft den vom Sicherheitsbefund verlangten Fall: eine importierte
// Exportdatei mit unbekanntem/manipuliertem "Tabellennamen" darf nie als
// SQL-Bezeichner verwendet werden. Ursprünglich lag die Lücke in
// src/settings/db.ts (generische readTable/replaceTable/upsertRow-Funktionen
// mit interpoliertem Tabellennamen); diese Funktionen sind inzwischen durch
// Agent B's src/data/ ersetzt, deren importAllInto() nur feste, im Code
// hart verdrahtete Felder liest (bundle.progress, bundle.reviews, ...) und
// nie einen Tabellennamen aus der JSON-Datei in SQL einsetzt. Dieser Test
// belegt das Verhalten: ein zusätzliches, unbekanntes Feld wird ignoriert
// statt verarbeitet, und eine Datei ohne die erwarteten Felder wird
// abgelehnt (fail-closed), statt teilweise zu schreiben.
import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { importAll } from '../data/exportImport.js';
import { EXPORTABLE_TABLES } from './types.js';
import { importExportJson } from './importExport.js';
import { wipeAllTables } from './db.js';

describe('Import-Sicherheit (kein Tabellenname aus einer Importdatei in SQL)', () => {
  it('delete-all deckt alle persönlichen Tabellen inklusive Playlist-Inhalte ab', () => {
    expect(EXPORTABLE_TABLES).toEqual(['progress','reviews','legacy_review_archive','notes','bookmarks','settings','portfolio_items','career_checklist','exam_results','playlist_items','playlists']);
  });

  it('wipeAllTables entfernt auch Playlists und Playlist-Items atomar', async () => {
    const db = await getDatabase();
    const playlist = await db.createPlaylist('Keep? no');
    await db.addPlaylistItem(playlist.id, 'M01-01-01');
    await db.upsertProgress({ lessonId: 'M01-01-01', state: 'started', readUntil: null, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' });
    await wipeAllTables();
    expect(await db.listProgress()).toEqual([]);
    expect(await db.listPlaylists()).toEqual([]);
    expect(await db.listPlaylistItems(playlist.id)).toEqual([]);
    expect(await db.listSettings()).toEqual([]);
  });

  it('Einstellungen-JSON-Einstieg weist beschädigte Dateien vor Änderungen zurück', async () => {
    const db = await getDatabase();
    await db.upsertNote({ id: 'keep', lessonId: 'M01-01-01', body: 'bleibt', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    await expect(importExportJson('{broken')).rejects.toThrow();
    const rejected = JSON.stringify({ schemaVersion: 2, notes: [{ id: 42 }] });
    await expect(importExportJson(rejected)).rejects.toThrow();
    expect((await db.listNotes()).map((n) => n.id)).toEqual(['keep']);
  });
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('lehnt eine Importdatei ohne die erwarteten Tabellenfelder ab (fail-closed)', async () => {
    const malicious = {
      schemaVersion: 1,
      // Kein "progress", "reviews", ... Array vorhanden, dafür ein
      // präparierter Schlüssel, der wie ein SQL-Tabellenname aussieht.
      'settings; DROP TABLE settings; --': [{ key: 'x', value: 'y' }],
    };
    await expect(importAll(malicious)).rejects.toThrow();

    // Die Datenbank bleibt unverändert nutzbar (kein Absturz, keine
    // ausgeführte Fremd-Anweisung): der präparierte Schlüssel landet nicht
    // als Zeile in "settings" (nur das von init() gesetzte schema_version).
    const db = await getDatabase();
    const keys = (await db.listSettings()).map((row) => row.key);
    expect(keys).not.toContain('settings; DROP TABLE settings; --');
    expect(keys).toEqual(['schema_version']);
  });

  it('verarbeitet nur die acht bekannten Tabellenfelder, ein zusätzliches Feld wird ignoriert', async () => {
    const withExtraField = {
      schemaVersion: 1,
      progress: [],
      reviews: [],
      notes: [],
      bookmarks: [],
      settings: [{ key: 'daily_goal_minutes', value: '20' }],
      portfolio_items: [],
      career_checklist: [],
      exam_results: [],
      // Zusätzliches, unbekanntes Feld: darf nicht als Tabellenname benutzt werden.
      'users; DROP TABLE settings; --': [{ anything: 'ignored' }],
    };
    await expect(importAll(withExtraField)).resolves.not.toThrow();

    const db = await getDatabase();
    expect(await db.getSetting('daily_goal_minutes')).toBe('20');
    // Kein Absturz, keine zusätzliche Tabelle/Zeile aus dem Fremdfeld
    // übernommen (nur schema_version von init() plus die eine importierte Zeile).
    const keys = (await db.listSettings()).map((row) => row.key);
    expect(keys.sort()).toEqual(['daily_goal_minutes', 'schema_version']);
  });
});
