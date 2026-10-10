import { getSetting, setSetting } from '../data/settings.js';
import { isValidAnswers, parseResult, type PlacementResult } from './assessment.js';
export const PLACEMENT_KEY = 'placement_v1';
export async function loadPlacement(): Promise<PlacementResult | null> { return parseResult(await getSetting(PLACEMENT_KEY)); }
export async function savePlacement(result: PlacementResult): Promise<void> {
  if (!isValidAnswers(result.answers) || !parseResult(JSON.stringify(result))) throw new Error('Unvollständige Einstufung');
  await setSetting(PLACEMENT_KEY, JSON.stringify(result));
}
