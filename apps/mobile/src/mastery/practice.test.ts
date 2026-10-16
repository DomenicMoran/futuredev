import { describe, expect, it } from 'vitest';
import { getBundledLesson } from '../content/bundledData.js';
import { resetToMemoryDatabase } from '../data/db.js';
import { exportAllFrom, importAllInto } from '../data/exportImport.js';
import { emptyPractice, parsePractice, savePractice, validatePractice } from './practice.js';

const lesson = getBundledLesson('M01-00-01');
if (!lesson) throw new Error('Missing practice fixture');

describe('practice evidence validation', () => {
  it('explains corrupt JSON in German with a recovery action', () => {
    expect(() => validatePractice('{')).toThrow('Datensicherung importieren');
  });
  it('rejects duplicated or impossible checklist marks and fabricated completion', () => {
    const initial = emptyPractice(lesson);
    expect(() => parsePractice(JSON.stringify({ ...initial, checked: [0, 0] }), lesson)).toThrow();
    expect(() => parsePractice(JSON.stringify({ ...initial, checked: [999] }), lesson)).toThrow();
    expect(() =>
      parsePractice(JSON.stringify({ ...initial, completedAt: new Date().toISOString() }), lesson),
    ).toThrow();
    expect(() => validatePractice(JSON.stringify({ ...initial, completedAt: 2026 }))).toThrow();
  });
  it('preserves the old draft but never saves stale completion after an updated task', async () => {
    resetToMemoryDatabase();
    const initial = { ...emptyPractice(lesson), explanation: 'My old explanation' };
    const changed = { ...lesson, practiceTask: { ...lesson.practiceTask, task: 'Updated task' } };
    expect(parsePractice(JSON.stringify(initial), changed)).toEqual({
      ...emptyPractice(changed),
      explanation: initial.explanation,
    });
    await expect(savePractice(changed, initial)).rejects.toThrow('geändert');
  });
  it('rejects malformed practice imports before any table changes', async () => {
    const db = resetToMemoryDatabase();
    const bundle = await exportAllFrom(db);
    bundle.settings.push(
      { key: 'practice_v1.M01-00-01', value: '{' },
      { key: 'unrelated', value: 'new' },
    );
    await expect(importAllInto(db, bundle)).rejects.toThrow('Praxisentwurf');
    expect(await db.listSettings()).toEqual([]);
  });
});
