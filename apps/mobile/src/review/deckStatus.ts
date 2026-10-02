export type ReviewDeckStatus = 'loading' | 'error' | 'empty' | 'future' | 'due';

/** Classifies the persisted deck independently from its current load error. */
export function getReviewDeckStatus(totalCards: number | null, dueCards: number | null, loadError: boolean): ReviewDeckStatus {
  if (loadError) return 'error';
  if (totalCards === null || dueCards === null) return 'loading';
  if (totalCards === 0) return 'empty';
  if (dueCards === 0) return 'future';
  return 'due';
}
