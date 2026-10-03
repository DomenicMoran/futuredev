/** Compact, unambiguous curriculum totals instead of three-digit minute counts. */
export function formatLearningDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${total} Min.`;
  return remainder ? `${hours} Std. ${remainder} Min.` : `${hours} Std.`;
}
