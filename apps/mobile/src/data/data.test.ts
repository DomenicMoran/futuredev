import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDatabase } from './memoryDatabase.js';
import { resetToMemoryDatabase, getDatabase, setDatabase } from './db.js';
import { getProgress, markLessonState, saveReadPosition } from './progress.js';
import { listNotes, saveNote } from './notes.js';
import { listBookmarks, toggleBookmark } from './bookmarks.js';
import { getSetting, getOrCreateInstallId, setSetting } from './settings.js';
import { exportAllFrom, importAllInto, exportAll, importAll, parseExportBundle } from './exportImport.js';
import {
  addLessonToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylistItems,
  listPlaylists,
  removePlaylistItem,
  renamePlaylist,
} from './playlists.js';
import { EXPORT_VERSION, SCHEMA_VERSION } from './types.js';

const sqliteMock = vi.hoisted(() => ({ imported: false, openDatabaseAsync: vi.fn() }));
vi.mock('expo-sqlite', () => { sqliteMock.imported = true; return sqliteMock; });

describe('Database-Schnittstelle (MemoryDatabase)', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('legt schema_version bei init() an', async () => {
    const db = await getDatabase();
    expect(await db.getSchemaVersion()).toBe(SCHEMA_VERSION);
  });

  it('speichert und liest Fortschritt (upsertProgress/getProgress)', async () => {
    expect(await getProgress('M01-01-01')).toBeUndefined();
    const updated = await markLessonState('M01-01-01', 'started');
    expect(updated.state).toBe('started');
    expect((await getProgress('M01-01-01'))?.state).toBe('started');
  });

  it('lehnt einen nicht erlaubten Zustandsuebergang ab (core.transitionLesson)', async () => {
    await markLessonState('M01-01-01', 'started');
    // 'completed' ist von 'started' aus nicht erlaubt (erst read/listened, dann quiz_passed).
    const result = await markLessonState('M01-01-01', 'completed');
    expect(result.state).toBe('started');
  });

  it('merkt sich die Leseposition und setzt den Zustand auf "started"', async () => {
    const row = await saveReadPosition('M01-01-01', 3);
    expect(row.readUntil).toBe(3);
    expect(row.state).toBe('started');
  });

  it('notes: anlegen, auflisten, nach Lektion filtern', async () => {
    await saveNote('n1', 'M01-01-01', 'Erste Notiz');
    await saveNote('n2', 'M01-01-02', 'Andere Lektion');
    expect(await listNotes()).toHaveLength(2);
    expect(await listNotes('M01-01-01')).toHaveLength(1);
  });

  it('notes: dieselbe id aktualisiert statt zu duplizieren', async () => {
    await saveNote('n1', 'M01-01-01', 'Erste Fassung');
    const updated = await saveNote('n1', 'M01-01-01', 'Zweite Fassung');
    const all = await listNotes('M01-01-01');
    expect(all).toHaveLength(1);
    expect(all[0]?.body).toBe('Zweite Fassung');
    expect(updated.createdAt).toBe(all[0]?.createdAt);
  });

  it('playlists: anlegen, Lektionen hinzufügen, umbenennen, entfernen, löschen', async () => {
    expect(await listPlaylists()).toHaveLength(0);
    const pl = await createPlaylist('Unterwegs');
    expect(pl.name).toBe('Unterwegs');
    await addLessonToPlaylist(pl.id, 'M01-01-01');
    await addLessonToPlaylist(pl.id, 'M01-01-02');
    await addLessonToPlaylist(pl.id, 'M01-01-01');
    const items = await listPlaylistItems(pl.id);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.lessonId)).toEqual(['M01-01-01', 'M01-01-02']);
    await renamePlaylist(pl.id, 'Favoriten');
    expect((await listPlaylists())[0]?.name).toBe('Favoriten');
    await removePlaylistItem(pl.id, 'M01-01-01');
    expect(await listPlaylistItems(pl.id)).toHaveLength(1);
    await deletePlaylist(pl.id);
    expect(await listPlaylists()).toHaveLength(0);
  });

  it('bookmarks: setzen und wieder entfernen (toggle)', async () => {
    expect(await toggleBookmark('M01-01-01', 5)).toBe(true);
    expect(await listBookmarks('M01-01-01')).toHaveLength(1);
    expect(await toggleBookmark('M01-01-01', 5)).toBe(false);
    expect(await listBookmarks('M01-01-01')).toHaveLength(0);
  });

  it('settings: install_id wird einmalig erzeugt und danach wiederverwendet', async () => {
    const first = await getOrCreateInstallId();
    const second = await getOrCreateInstallId();
    expect(first).toBe(second);
    expect(await getSetting('install_id')).toBe(first);
  });

  it('exportAll liefert schemaVersion und persönliche Tabellen einschließlich Playlists', async () => {
    await markLessonState('M01-01-01', 'started');
    await saveNote('n1', 'M01-01-01', 'Notiz');
    const bundle = await exportAll();
    expect(bundle.schemaVersion).toBe(EXPORT_VERSION);
    expect(bundle.progress).toHaveLength(1);
    expect(bundle.notes).toHaveLength(1);
    expect(bundle.reviews).toEqual([]);
    expect(bundle.bookmarks).toEqual([]);
    expect(bundle.portfolio_items).toEqual([]);
    expect(bundle.career_checklist).toEqual([]);
    expect(bundle.exam_results).toEqual([]);
    expect(bundle.playlists).toEqual([]);
    expect(bundle.playlist_items).toEqual([]);
  });

  it('importAll: neuerer Zeitstempel gewinnt bei einem Konflikt', async () => {
    await setSetting('unrelated', '1'); // stellt sicher, dass init gelaufen ist
    await saveNote('n1', 'M01-01-01', 'Alt');
    const older = await listNotes('M01-01-01');
    const olderNote = older[0];
    if (!olderNote) throw new Error('Testvoraussetzung verletzt: Notiz fehlt');

    const staleBundle = await exportAll();
    // Aeltere Fassung, kuenstlich mit frueherem Zeitstempel:
    staleBundle.notes = [{ ...olderNote, body: 'Veraltet aus Export', updatedAt: '2000-01-01T00:00:00.000Z' }];
    await importAll(staleBundle);
    expect((await listNotes('M01-01-01'))[0]?.body).toBe('Alt');

    const freshBundle = await exportAll();
    freshBundle.notes = [{ ...olderNote, body: 'Neuer aus Export', updatedAt: '2999-01-01T00:00:00.000Z' }];
    await importAll(freshBundle);
    expect((await listNotes('M01-01-01'))[0]?.body).toBe('Neuer aus Export');
  });

  it('importAll: fehlende Tabelle im JSON bricht kontrolliert ab, ohne etwas zu schreiben', async () => {
    await saveNote('n1', 'M01-01-01', 'Bestehend');
    await expect(importAll({ schemaVersion: 1, progress: [] })).rejects.toThrow();
    expect(await listNotes('M01-01-01')).toHaveLength(1);
  });

  it('exportAllFrom/importAllInto funktionieren direkt gegen eine uebergebene Database', async () => {
    const source = createMemoryDatabase();
    await source.init();
    await source.upsertNote({ id: 'x1', lessonId: 'M01-01-01', body: 'Quelle', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    const bundle = await exportAllFrom(source);

    const target = createMemoryDatabase();
    await target.init();
    await importAllInto(target, bundle);
    expect((await target.listNotes())[0]?.body).toBe('Quelle');
  });

  it('vollständiger Export-Roundtrip erhält alle persönlichen Tabellen und Playlist-Reihenfolge', async () => {
    const source = createMemoryDatabase(); await source.init();
    await source.upsertProgress({ lessonId: 'M01-01-01', state: 'started', readUntil: 3, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' });
    await source.upsertReview({ sourceLessonId: 'M01-01-01', questionId: 'q_00000000-0000-4000-8000-000000000001', leitnerStage: 2, dueAt: '2026-02-01T00:00:00.000Z', errorCount: 1 });
    await source.upsertNote({ id: 'n', lessonId: 'M01-01-01', body: 'note', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' });
    await source.upsertBookmark({ id: 'b', lessonId: 'M01-01-01', position: 2, createdAt: '2026-01-01T00:00:00.000Z' });
    await source.setSetting('theme', 'dark');
    await source.upsertPortfolioItem({ id: 'p', baustein: 'P00', status: 'offen', url: null, updatedAt: '2026-01-01T00:00:00.000Z' });
    await source.upsertCareerChecklistItem({ item: 'cv', checked: true, updatedAt: '2026-01-01T00:00:00.000Z' });
    await source.insertExamResult({ id: 'e', scope: 'gesamt', score: 8, passed: true, takenAt: '2026-01-01T00:00:00.000Z' });
    const pl = await source.createPlaylist('Favoriten'); await source.addPlaylistItem(pl.id, 'M01-01-02'); await source.addPlaylistItem(pl.id, 'M01-01-01');
    const bundle = await exportAllFrom(source);
    const target = createMemoryDatabase(); await target.init(); await importAllInto(target, bundle);
    expect(await exportAllFrom(target)).toEqual(bundle);
  });

  it('validiert jede Zeile vor dem ersten Schreibzugriff', async () => {
    const db = createMemoryDatabase(); await db.init();
    await db.upsertNote({ id: 'old', lessonId: 'M01-01-01', body: 'keep', createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    const bad = await exportAllFrom(createMemoryDatabase());
    bad.notes = [{ id: 'new', lessonId: 'M01-01-01', body: 'x', createdAt: 'x', updatedAt: 'x' }, { id: 'bad' } as never];
    await expect(importAllInto(db, bad)).rejects.toThrow(/ungültige Zeile/);
    expect(await db.listNotes()).toEqual([{ id: 'old', lessonId: 'M01-01-01', body: 'keep', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]);
  });

  it('rollt bei Schreibfehlern die gesamte Importtransaktion zurück', async () => {
    const db = createMemoryDatabase(); await db.init();
    const payload = await exportAllFrom(createMemoryDatabase());
    payload.progress = [{ lessonId: 'M01-01-01', state: 'started', readUntil: 1, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' }];
    db.upsertNote = async () => { throw new Error('simulierter Speicherfehler'); };
    payload.notes = [{ id: 'n', lessonId: 'M01-01-01', body: 'x', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }];
    await expect(importAllInto(db, payload)).rejects.toThrow('simulierter Speicherfehler');
    expect(await db.listProgress()).toEqual([]);
  });

  it('erlaubt Snapshot-Export innerhalb einer vorhandenen Transaktion ohne Deadlock', async () => {
    const db = createMemoryDatabase(); await db.init();
    const snapshot = await db.transaction(async (tx) => exportAllFrom(tx));
    expect(snapshot.schemaVersion).toBe(EXPORT_VERSION);
  });

  it('akzeptiert v1 und v2 Backups ohne Playlist-Felder, lehnt unbekannte Version ab, ohne Eingabe zu mutieren', async () => {
    const bundle = await exportAllFrom(createMemoryDatabase());
    const legacyV1 = { ...bundle, schemaVersion: 1 };
    delete (legacyV1 as Partial<typeof bundle>).playlists;
    delete (legacyV1 as Partial<typeof bundle>).playlist_items;
    const legacyFields = { ...legacyV1 };
    delete (legacyFields as Partial<typeof bundle>).playlists;
    delete (legacyFields as Partial<typeof bundle>).playlist_items;
    await expect(importAllInto(createMemoryDatabase(), legacyV1)).resolves.toBeUndefined();
    await expect(importAllInto(createMemoryDatabase(), { ...legacyFields, schemaVersion: 2 })).resolves.toBeUndefined();
    expect('playlists' in legacyV1).toBe(false);
    await expect(importAllInto(createMemoryDatabase(), { ...bundle, schemaVersion: 999 })).rejects.toThrow(/schemaVersion/);
  });

  it('archiviert Legacy-Review-Indices aus v1/v2/v3 verlustfrei statt sie als neue questionIds zu raten', async () => {
    const current = await exportAllFrom(createMemoryDatabase());
    const legacyReview = { lessonId: 'M01-01-01', leitnerStage: 3, dueAt: '2026-09-26T10:00:00.000Z', errorCount: 2 };
    const v2: Record<string, unknown> = { ...current, schemaVersion: 2, reviews: [legacyReview] };
    delete v2.playlists;
    delete v2.playlist_items;
    const parsedV2 = parseExportBundle(v2);
    expect(parsedV2.reviews).toEqual([]);
    expect(parsedV2.legacyReviewArchive).toMatchObject([{ id: 'M01-01-01', leitnerStage: 3, dueAt: legacyReview.dueAt, errorCount: 2, reason: 'legacy-question-index-unknown' }]);

    const v3: Record<string, unknown> = { ...current, schemaVersion: 3, reviews: [legacyReview] };
    delete v3.legacyReviewArchive;
    const parsedV3 = parseExportBundle(v3);
    expect(parsedV3.legacyReviewArchive[0]?.id).toBe('M01-01-01');
    const target = createMemoryDatabase(); await target.init();
    await importAllInto(target, v3);
    expect(await target.listReviews()).toEqual([]);
    expect(await target.listLegacyReviewArchive()).toMatchObject([{ id: 'M01-01-01', errorCount: 2 }]);
  });

  it('vergleicht Offsets als Zeitwerte und lässt bei älterem Backup neuere Notiz stehen', async () => {
    const db = createMemoryDatabase(); await db.init();
    await db.upsertNote({ id: 'n', lessonId: 'M01-01-01', body: 'neu', createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T10:00:00.000Z' });
    const bundle = await exportAllFrom(createMemoryDatabase());
    bundle.notes = [{ id: 'n', lessonId: 'M01-01-01', body: 'alt', createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T11:00:00.000+02:00' }];
    await importAllInto(db, bundle);
    expect((await db.listNotes())[0]?.body).toBe('neu');
  });

  it('weist falsch typisierte Enum-Werte und doppelte Primärschlüssel vor Änderungen zurück', async () => {
    const db = createMemoryDatabase(); await db.init();
    await db.upsertProgress({ lessonId: 'keep', state: 'started', readUntil: 1, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' });
    const base = await exportAllFrom(createMemoryDatabase());
    base.progress = [{ lessonId: 'bad', state: ['completed'] as never, readUntil: null, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' }];
    await expect(importAllInto(db, base)).rejects.toThrow(/ungültige Zeile/);
    const duplicates = await exportAllFrom(createMemoryDatabase());
    const duplicate = { lessonId: 'dup', state: 'started' as const, readUntil: null, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' };
    duplicates.progress = [duplicate, duplicate];
    await expect(importAllInto(db, duplicates)).rejects.toThrow(/doppelter Schlüssel/);
    expect((await db.listProgress()).map((r) => r.lessonId)).toEqual(['keep']);
  });
});

describe('setDatabase erlaubt das Austauschen der Implementierung', () => {
  it('injizierte MemoryDatabase wird von getDatabase() zurueckgegeben', async () => {
    const injected = createMemoryDatabase();
    setDatabase(injected);
    expect(await getDatabase()).toBe(injected);
  });

  it('lädt bei bereits injizierter MemoryDatabase den nativen SQLite-Adapter nicht nach', async () => {
    const injected = createMemoryDatabase();
    setDatabase(injected);
    expect(await getDatabase()).toBe(injected);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(sqliteMock.imported).toBe(false);
  });
});

describe('MemoryDatabase verschachtelte Transaktionen', () => {
  it('behandelt verschachtelte Transaktionen als JOIN ohne Savepoint', async () => {
    const db = createMemoryDatabase();
    await db.init();
    await db.transaction(async (outer) => {
      try {
        await outer.transaction(async (inner) => {
          await inner.upsertProgress({ lessonId: 'joined', state: 'started', readUntil: 1, listenedUntil: null, quizScore: null, quizPassed: false, updatedAt: '2026-01-01T00:00:00.000Z' });
          throw new Error('caught nested failure');
        });
      } catch { /* outer caller elects to continue and commit */ }
    });
    expect((await db.getProgress('joined'))?.state).toBe('started');
  });
});
