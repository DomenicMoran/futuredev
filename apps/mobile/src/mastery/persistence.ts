import { getDatabase } from '../data/db.js';
import { parseState, type MasteryState } from './engine.js';
export const MASTERY_KEY = 'mastery_v1';
export const REVIEW_AUDIO_SCOPE = 'mastery_audio_scope_v1';
export const loadMastery = async (): Promise<MasteryState> =>
  parseState(await (await getDatabase()).getSetting(MASTERY_KEY));
export async function saveMastery(state: MasteryState): Promise<void> {
  const raw = JSON.stringify(state);
  parseState(raw);
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const previous = await tx.getSetting(MASTERY_KEY);
    const previousRound = previous ? parseState(previous).history.at(-1)?.at : undefined;
    const last = state.history.at(-1);
    await tx.setSetting(MASTERY_KEY, raw);
    if (last && last.at !== previousRound) {
      const ids = [
        ...new Set(
          Object.entries(state.results)
            .filter(([, correct]) => !correct)
            .map(([key]) => key.split('/')[0] ?? ''),
        ),
      ];
      // Carry unrelated module reviews into the next round. Only evaluated lessons restart.
      const oldScopeRaw = await tx.getSetting(REVIEW_AUDIO_SCOPE);
      if (oldScopeRaw && last.affectedLessons) {
        const oldScope = JSON.parse(oldScopeRaw) as { cycle: string; ids: string[] };
        const affected = new Set(last.affectedLessons);
        for (const id of ids) {
          if (affected.has(id) || !oldScope.ids.includes(id)) continue;
          const key = 'mastery.hearing.v1.' + id;
          const rawReview = await tx.getSetting(key);
          if (!rawReview) continue;
          const review = JSON.parse(rawReview) as { cycle?: string; value?: unknown } | null;
          if (review?.cycle === oldScope.cycle)
            await tx.setSetting(key, JSON.stringify({ ...review, cycle: last.at }));
        }
      }
      await tx.setSetting(REVIEW_AUDIO_SCOPE, JSON.stringify({ cycle: last.at, ids }));
    }
  });
}
