import { getDatabase } from '../data/db.js';
import type { Database } from '../data/types.js';
import { migrateMastery, parseState, type BankQuestion, type MasteryState } from './engine.js';
export const MASTERY_KEY = 'mastery_v1';
export const REVIEW_AUDIO_SCOPE = 'mastery_audio_scope_v1';
export async function loadMastery(bank?: BankQuestion[]): Promise<MasteryState> {
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const raw = await tx.getSetting(MASTERY_KEY);
    const state = parseState(raw);
    if (!bank) return state;
    const next = migrateMastery(state, bank);
    if (raw !== undefined && JSON.stringify(next) !== raw)
      await tx.setSetting(MASTERY_KEY, JSON.stringify(next));
    return next;
  });
}
export async function saveMastery(state: MasteryState, expected?: MasteryState): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    if (
      expected &&
      JSON.stringify(parseState(await tx.getSetting(MASTERY_KEY))) !== JSON.stringify(expected)
    )
      throw new Error(
        'Der Lernstand wurde inzwischen geändert. Bitte neu laden; deine gespeicherten Ergebnisse bleiben erhalten.',
      );
    await writeMastery(tx, state);
  });
}
/** Shared by every quiz surface, inside the caller's existing atomic transaction. */
export async function writeMastery(tx: Database, state: MasteryState): Promise<void> {
  const raw = JSON.stringify(state);
  parseState(raw);
  const previous = await tx.getSetting(MASTERY_KEY);
  const previousState = parseState(previous);
  const previousRound = previousState.history.at(-1)?.at;
  const last = state.history.at(-1);
  if (previous && previous !== raw) await tx.setSetting('mastery_backup_v1', previous);
  await tx.setSetting(MASTERY_KEY, raw);
  for (const [key, recall] of Object.entries(state.recall ?? {})) {
    if (JSON.stringify(previousState.recall?.[key]) === JSON.stringify(recall)) continue;
    const slash = key.indexOf('/');
    const colon = key.indexOf(':', slash);
    if (slash < 1 || colon <= slash + 1) throw new Error('Ungültige Fragenkennung.');
    await tx.upsertReview({
      sourceLessonId: key.slice(0, slash),
      questionId: key.slice(slash + 1, colon),
      leitnerStage: recall.stage,
      dueAt: recall.dueAt,
      errorCount: recall.errors,
    });
  }
  if (last && last.at !== previousRound) {
    const latest = new Map<string, string>();
    for (const key of Object.keys(state.results)) {
      const stable = key.split(':')[0] ?? key;
      const prior = latest.get(stable);
      if (!prior || (state.recall?.[key]?.lastAt ?? '') > (state.recall?.[prior]?.lastAt ?? ''))
        latest.set(stable, key);
    }
    const ids = [
      ...new Set(
        [...latest.values()]
          .filter((key) => state.results[key] === false)
          .map((key) => key.split('/')[0] ?? ''),
      ),
    ];
    // Carry unrelated module reviews into the next round. Only evaluated lessons restart.
    const oldScopeRaw = await tx.getSetting(REVIEW_AUDIO_SCOPE);
    if (oldScopeRaw && last.affectedLessons) {
      const oldScope = safeScope(oldScopeRaw);
      const affected = new Set(last.affectedLessons);
      for (const id of ids) {
        if (affected.has(id) || !oldScope?.ids.includes(id)) continue;
        const key = 'mastery.hearing.v1.' + id;
        const rawReview = await tx.getSetting(key);
        if (!rawReview) continue;
        const review = safeReview(rawReview);
        if (review?.cycle === oldScope.cycle)
          await tx.setSetting(key, JSON.stringify({ ...review, cycle: last.at }));
      }
    }
    await tx.setSetting(REVIEW_AUDIO_SCOPE, JSON.stringify({ cycle: last.at, ids }));
  }
}

function safeScope(raw: string): { cycle: string; ids: string[] } | null {
  try {
    const v = JSON.parse(raw);
    return v &&
      typeof v.cycle === 'string' &&
      Array.isArray(v.ids) &&
      v.ids.every((id: unknown) => typeof id === 'string')
      ? v
      : null;
  } catch {
    return null;
  }
}
function safeReview(raw: string): { cycle: string; value: unknown } | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v.cycle === 'string' ? v : null;
  } catch {
    return null;
  }
}
export async function recoverMastery(): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const backup = await tx.getSetting('mastery_backup_v1');
    if (!backup)
      throw new Error('Keine lokale Sicherung vorhanden. Bitte Datenexport importieren.');
    const restored = parseState(backup);
    await restoreMasterySnapshot(tx, restored);
  });
}

/** Restore evidence and its derived review queue in the caller's transaction. */
export async function restoreMasterySnapshot(tx: Database, restored: MasteryState): Promise<void> {
  parseState(JSON.stringify(restored));
  // A damaged primary snapshot cannot tell us which cards advanced since the
  // backup. Never retain later confidence: unknown cards become due again.
  const evidence = new Map<string, NonNullable<MasteryState['recall']>[string]>();
  for (const [key, recall] of Object.entries(restored.recall ?? {})) {
    const stable = key.slice(0, key.indexOf(':'));
    const prior = evidence.get(stable);
    if (!prior || prior.lastAt < recall.lastAt) evidence.set(stable, recall);
  }
  const dueNow = new Date().toISOString();
  for (const row of await tx.listReviews()) {
    const recall = evidence.get(`${row.sourceLessonId}/${row.questionId}`);
    await tx.upsertReview({
      ...row,
      leitnerStage: recall?.stage ?? 1,
      dueAt: recall?.dueAt ?? dueNow,
      errorCount: recall?.errors ?? row.errorCount,
    });
  }
  for (const [stable, recall] of evidence) {
    const slash = stable.indexOf('/');
    await tx.upsertReview({
      sourceLessonId: stable.slice(0, slash),
      questionId: stable.slice(slash + 1),
      leitnerStage: recall.stage,
      dueAt: recall.dueAt,
      errorCount: recall.errors,
    });
  }
  await tx.setSetting(MASTERY_KEY, JSON.stringify(restored));
  await tx.setSetting(REVIEW_AUDIO_SCOPE, JSON.stringify({ cycle: '', ids: [] }));
}
