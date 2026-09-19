// Baut den Zusammenfuegeplan fuer eine Lektion: Bloecke und die Stille dazwischen.
// Reine Funktion, ohne Dateizugriff, damit sie ohne ffmpeg getestet werden kann.

export interface SpeechBlockLike {
  readonly speaker: 'A' | 'B';
}

export type ConcatStep =
  | { readonly type: 'block'; readonly index: number }
  | { readonly type: 'silence'; readonly milliseconds: number };

// 300 ms zwischen Bloecken derselben Stimme, 600 ms bei Sprecherwechsel: eine
// reine Pause wirkt wie ein Atemzug, ein Sprecherwechsel braucht spuerbar mehr
// Abstand, sonst klingen A und B wie eine Stimme, die sich selbst unterbricht.
const SAME_SPEAKER_SILENCE_MS = 300;
const SPEAKER_CHANGE_SILENCE_MS = 600;

/** Erzeugt die Abfolge aus Blöcken und Stille-Segmenten fuer eine Lektion. */
export function buildConcatPlan(blocks: readonly SpeechBlockLike[]): ConcatStep[] {
  const plan: ConcatStep[] = [];
  blocks.forEach((block, index) => {
    if (index > 0) {
      const previous = blocks[index - 1];
      const milliseconds =
        previous?.speaker === block.speaker ? SAME_SPEAKER_SILENCE_MS : SPEAKER_CHANGE_SILENCE_MS;
      plan.push({ type: 'silence', milliseconds });
    }
    plan.push({ type: 'block', index });
  });
  return plan;
}

/** Alle unterschiedlichen Stille-Laengen, die ein Plan braucht (fuer die Stille-Dateien). */
export function distinctSilenceDurations(plan: readonly ConcatStep[]): number[] {
  const durations = new Set<number>();
  for (const step of plan) {
    if (step.type === 'silence') durations.add(step.milliseconds);
  }
  return [...durations].sort((a, b) => a - b);
}
