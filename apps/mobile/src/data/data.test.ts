import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase } from './memoryDatabase.js';
import { resetToMemoryDatabase, getDatabase, setDatabase } from './db.js';
import { getProgress, markLessonState, saveReadPosition } from './progress.js';
import { listNotes, saveNote } from './notes.js';
import { listBookmarks, toggleBookmark } from './bookmarks.js';
import { getSetting, getOrCreateInstallId, setSetting } from './settings.js';
import { exportAllFrom, importAllInto, exportAll, importAll } from './exportImport.js';
import { SCHEMA_VERSION } from './types.js';

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

  it('exportAll liefert schemaVersion und alle acht Tabellen als Arrays', async () => {
    await markLessonState('M01-01-01', 'started');
    await saveNote('n1', 'M01-01-01', 'Notiz');
    const bundle = await exportAll();
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
    expect(bundle.progress).toHaveLength(1);
    expect(bundle.notes).toHaveLength(1);
    expect(bundle.reviews).toEqual([]);
    expect(bundle.bookmarks).toEqual([]);
    expect(bundle.portfolio_items).toEqual([]);
    expect(bundle.career_checklist).toEqual([]);
    expect(bundle.exam_results).toEqual([]);
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
    await source.upsertNote({ id: 'x1', lessonId: 'M01-01-01', body: 'Quelle', createdAt: 'a', updatedAt: 'a' });
    const bundle = await exportAllFrom(source);

    const target = createMemoryDatabase();
    await target.init();
    await importAllInto(target, bundle);
    expect((await target.listNotes())[0]?.body).toBe('Quelle');
  });
});

describe('setDatabase erlaubt das Austauschen der Implementierung', () => {
  it('injizierte MemoryDatabase wird von getDatabase() zurueckgegeben', async () => {
    const injected = createMemoryDatabase();
    setDatabase(injected);
    expect(await getDatabase()).toBe(injected);
  });
});
