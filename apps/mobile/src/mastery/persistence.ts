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
            .map(([key]) => key.split('/')[0]),
        ),
      ];
      await tx.setSetting(REVIEW_AUDIO_SCOPE, JSON.stringify({ cycle: last.at, ids }));
    }
  });
}
