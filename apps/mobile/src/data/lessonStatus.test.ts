import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from './db.js';
import { deriveLessonStatus, shouldImportLessonStatus, listLessonStatuses, parseStatusOverrides, setLessonStatus, undoLessonStatus } from './lessonStatus.js';
import { drainLessonProgressWrites, markLessonRead, saveListenPosition, saveReadPosition } from './progress.js';
import { exportAll, importAll } from './exportImport.js';
describe('independent lesson status marks', () => {
  beforeEach(() => { resetToMemoryDatabase(); });
  it('never awards quiz results, progress position or measured hearing for a manual mark', async () => {
    await setLessonStatus('M01-00-01', 'heard', true);
    await setLessonStatus('M01-00-01', 'done', true);
    const db = await getDatabase();
    expect(await db.getProgress('M01-00-01')).toBeUndefined();
    expect(await db.getSetting('hearing.v1.M01-00-01')).toBeUndefined();
    expect((await listLessonStatuses())['M01-00-01']).toMatchObject({ heard: true, done: true, quizPassed: false, listenedUntil: 0 });
  });
  it('persists marks across backup export/import and clears them with personal data', async () => {
    await setLessonStatus('M01-00-01', 'read', true);
    const backup = await exportAll();
    const db = await getDatabase(); await drainLessonProgressWrites(); await db.clearPersonalData();
    expect(await listLessonStatuses()).toEqual({});
    await importAll(backup);
    expect((await listLessonStatuses())['M01-00-01']?.read).toBe(true);
  });
  it('undo restores only prior overrides and refuses stale undo', async () => {
    const change = await setLessonStatus('a', 'heard', true);
    await undoLessonStatus('a', change);
    expect((await listLessonStatuses()).a?.heard).toBe(false);
    const first = await setLessonStatus('a', 'read', true);
    await setLessonStatus('a', 'done', true);
    await expect(undoLessonStatus('a', first)).rejects.toThrow('inzwischen');
    expect((await listLessonStatuses()).a).toMatchObject({ read: true, done: true });
  });
  it('removing an override reveals actual coverage and does not delete measurements', () => {
    const measured = { seconds: 100, duration: 100, completed: true };
    expect(deriveLessonStatus(undefined, measured, { heard: false }).heard).toBe(false);
    expect(deriveLessonStatus(undefined, measured, {}).heard).toBe(true);
    expect(measured.seconds).toBe(100);
  });
  it('retains independent reading completion through listening and keeps audio chronology independent', async () => {
    await markLessonRead('a'); await saveListenPosition('a', 45);
    const db = await getDatabase(); const audioDate = await db.getSetting('audio.last.v1.a');
    await saveReadPosition('a', 20);
    expect(await db.getSetting('audio.last.v1.a')).toBe(audioDate);
    expect((await listLessonStatuses()).a).toMatchObject({ read: true, heard: false, listenedUntil: 45 });
  });
  it('merges only newer imported marks, keeping false and empty overrides as intentional edits', () => {
    const key = 'lesson.status.v1.a';
    const older = JSON.stringify({ revision: 'test', marks: { heard: true }, updatedAt: '2026-01-01T00:00:00Z' });
    const newer = JSON.stringify({ revision: 'test', marks: { heard: false }, updatedAt: '2026-01-02T00:00:00Z' });
    expect(shouldImportLessonStatus(key, older, newer)).toBe(true);
    expect(shouldImportLessonStatus(key, newer, older)).toBe(false);
    expect(shouldImportLessonStatus(key, newer, newer)).toBe(false);
    expect(shouldImportLessonStatus(key, older, '{"updatedAt":"2099-01-01T00:00:00Z"}')).toBe(false);
    expect(shouldImportLessonStatus('settings.goal', older, newer)).toBe(false);
    expect(shouldImportLessonStatus(key, older, JSON.stringify({ revision: 'test', marks: {}, updatedAt: '2026-01-03T00:00:00Z' }))).toBe(true);
  });
  it('rejects ABA undo even when the same flag values were restored by a newer edit', async () => {
    const change = await setLessonStatus('a', 'heard', true);
    await setLessonStatus('a', 'heard', false); await setLessonStatus('a', 'heard', true);
    await expect(undoLessonStatus('a', change)).rejects.toThrow('inzwischen');
  });
  it('sanitizes damaged and unknown override keys', () => {
    expect(parseStatusOverrides('broken')).toEqual({});
    expect(parseStatusOverrides('{"read":true,"heard":"true","quizPassed":true}')).toEqual({ read: true });
  });
});
