import { getDatabase } from './db.js';
import { serializeLessonWrite } from './progress.js';
import { listHearingProgress, type HearingProgress } from '../player/hearingProgress.js';
import type { ProgressRow } from './types.js';

export type StatusKind = 'read' | 'heard' | 'done';
export type StatusOverrides = Partial<Record<StatusKind, boolean>>;
export interface StatusChange { before: StatusOverrides; after: StatusOverrides; revision: string }
export interface LessonStatus {
  read: boolean; heard: boolean; done: boolean; quizPassed: boolean; started: boolean;
  overrides: StatusOverrides; listenedUntil: number; audioUpdatedAt: string; hearing?: HearingProgress;
}
const PREFIX = 'lesson.status.v1.';
export function parseStatusOverrides(raw?: string): StatusOverrides {
  try {
    let value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    if ('marks' in value) value = (value as { marks: unknown }).marks;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: StatusOverrides = {};
    for (const key of ['read', 'heard', 'done'] as const) if (typeof (value as StatusOverrides)[key] === 'boolean') result[key] = (value as StatusOverrides)[key];
    return result;
  } catch { return {}; }
}
export function deriveLessonStatus(row?: ProgressRow, hearing?: HearingProgress, overrides: StatusOverrides = {}, readCompleted = false, audioUpdatedAt = ''): LessonStatus {
  const read = overrides.read ?? (readCompleted || row?.state === 'read');
  const heard = overrides.heard ?? (hearing?.completed ?? false);
  const done = overrides.done ?? (row?.state === 'completed');
  return { read, heard, done, quizPassed: row?.quizPassed ?? false,
    started: read || heard || done || !!row && row.state !== 'new', overrides,
    listenedUntil: row?.listenedUntil ?? 0, audioUpdatedAt: audioUpdatedAt || ((row?.listenedUntil ?? 0) > 0 ? row?.updatedAt ?? '' : ''), hearing };
}
export const EMPTY_LESSON_STATUS = deriveLessonStatus();
export async function listLessonStatuses(): Promise<Record<string, LessonStatus>> {
  const db = await getDatabase();
  return db.transaction(async tx => {
  const [rows, settings, hearing] = await Promise.all([tx.listProgress(), tx.listSettings(), listHearingProgress(tx)]);
  const values = new Map(settings.map(row => [row.key, row.value]));
  const progress = new Map(rows.map(row => [row.lessonId, row]));
  const ids = new Set([...progress.keys(), ...Object.keys(hearing), ...settings.filter(row => row.key.startsWith(PREFIX)).map(row => row.key.slice(PREFIX.length))]);
  return Object.fromEntries([...ids].map(id => [id, deriveLessonStatus(progress.get(id), hearing[id], parseStatusOverrides(values.get(PREFIX + id)), values.get('read.completed.v1.' + id) === 'true', values.get('audio.last.v1.' + id))]));
  });
}
/** Uses the same reset barrier and transaction queue as progress. Measurements and quiz scores stay untouched. */
export function setLessonStatus(lessonId: string, kind: StatusKind, value: boolean | undefined): Promise<StatusChange> {
  return serializeLessonWrite(lessonId, async tx => {
    const before = parseStatusOverrides(await tx.getSetting(PREFIX + lessonId));
    const after: StatusOverrides = Object.fromEntries(Object.entries(before).filter(([key]) => key !== kind));
    if (value !== undefined) after[kind] = value;
    const revision = `${Date.now()}-${Math.random()}`;
    await tx.setSetting(PREFIX + lessonId, JSON.stringify({ marks: after, revision, updatedAt: new Date().toISOString() }));
    return { before, after, revision };
  });
}
/** Conditional undo cannot overwrite a newer edit on another screen. */
export function undoLessonStatus(lessonId: string, change: StatusChange): Promise<void> {
  return serializeLessonWrite(lessonId, async tx => {
    const raw = await tx.getSetting(PREFIX + lessonId);
    const revision = raw ? (JSON.parse(raw) as { revision?: string }).revision : undefined;
    if (revision !== change.revision) throw new Error('Die Markierung wurde inzwischen geändert.');
    await tx.setSetting(PREFIX + lessonId, JSON.stringify({ marks: change.before, revision: `${Date.now()}-${Math.random()}`, updatedAt: new Date().toISOString() }));
  });
}
export function lessonStatusLabel(status: LessonStatus): string {
  const labels = [status.done ? 'Erledigt' : '', status.read ? 'Gelesen' : '', status.heard ? (status.overrides.heard === true ? 'Als gehört markiert' : 'Vollständig gehört') : '', status.quizPassed ? 'Quiz bestanden' : ''].filter(Boolean);
  return labels.join(' · ') || (status.started ? 'Angefangen' : 'Noch nicht begonnen');
}

/** Local marks win ties; an explicitly newer imported mark (including false/empty) wins. */
export function shouldImportLessonStatus(key: string, existing: string, incoming: string): boolean {
  if (!key.startsWith(PREFIX)) return false;
  const timestamp = (raw: string) => {
    try {
      const value = JSON.parse(raw) as { marks?: unknown; revision?: unknown; updatedAt?: unknown };
      if (!value || typeof value.revision !== 'string' || !value.revision || typeof value.updatedAt !== 'string' || !value.marks || typeof value.marks !== 'object' || Array.isArray(value.marks)) return 0;
      if (!Object.entries(value.marks).every(([key, flag]) => ['read', 'heard', 'done'].includes(key) && typeof flag === 'boolean')) return 0;
      const date = Date.parse(value.updatedAt); return Number.isFinite(date) ? date : 0;
    } catch { return 0; }
  };
  return timestamp(incoming) > timestamp(existing);
}
