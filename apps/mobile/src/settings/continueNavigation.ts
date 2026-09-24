import { router } from 'expo-router';
import type { FirstFormPreference } from '../state/settings.js';
import { de } from '../i18n/de.js';
import { playLesson, seekToSeconds } from '../player/index.js';
import type { ContinueCard } from './startData.js';

export type ContinueMode = 'listen' | 'read';

export function resolveContinueMode(state: string, firstFormPreference: FirstFormPreference): ContinueMode {
  if (state === 'listened') return 'listen';
  if (state === 'read') return 'read';
  if (state === 'started') return firstFormPreference;
  return firstFormPreference;
}

export function continueActionLabel(mode: ContinueMode): string {
  return mode === 'listen' ? de.start.continueListenAction : de.start.continueReadAction;
}

export async function openContinueDestination(card: ContinueCard, firstFormPreference: FirstFormPreference): Promise<void> {
  const mode = resolveContinueMode(card.state, firstFormPreference);

  if (mode === 'listen') {
    await playLesson(card.lessonId);
    if (card.listenedUntil != null && card.listenedUntil > 0) {
      await seekToSeconds(card.listenedUntil);
    }
    router.push('/player');
    return;
  }

  if (card.readUntil != null && card.readUntil >= 0) {
    router.push({ pathname: '/lesson/[id]', params: { id: card.lessonId, block: String(card.readUntil) } });
    return;
  }

  router.push(`/lesson/${card.lessonId}`);
}
