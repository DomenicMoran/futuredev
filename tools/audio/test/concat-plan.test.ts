import { describe, expect, it } from 'vitest';
import { buildConcatPlan, distinctSilenceDurations } from '../src/concat-plan.js';

describe('buildConcatPlan', () => {
  it('setzt 300 ms Stille zwischen Bloecken derselben Stimme', () => {
    const plan = buildConcatPlan([{ speaker: 'A' }, { speaker: 'A' }]);
    expect(plan).toEqual([
      { type: 'block', index: 0 },
      { type: 'silence', milliseconds: 300 },
      { type: 'block', index: 1 },
    ]);
  });

  it('setzt 600 ms Stille bei Sprecherwechsel', () => {
    const plan = buildConcatPlan([{ speaker: 'A' }, { speaker: 'B' }]);
    expect(plan).toEqual([
      { type: 'block', index: 0 },
      { type: 'silence', milliseconds: 600 },
      { type: 'block', index: 1 },
    ]);
  });

  it('setzt keine Stille vor dem ersten Block', () => {
    const plan = buildConcatPlan([{ speaker: 'A' }]);
    expect(plan).toEqual([{ type: 'block', index: 0 }]);
  });

  it('mischt beide Pausen bei wechselnden Sprechern ueber mehrere Bloecke', () => {
    const plan = buildConcatPlan([{ speaker: 'A' }, { speaker: 'A' }, { speaker: 'B' }, { speaker: 'B' }]);
    expect(plan.map((s) => s.type)).toEqual(['block', 'silence', 'block', 'silence', 'block', 'silence', 'block']);
    const silences = plan.filter((s): s is { type: 'silence'; milliseconds: number } => s.type === 'silence');
    expect(silences.map((s) => s.milliseconds)).toEqual([300, 600, 300]);
  });
});

describe('distinctSilenceDurations', () => {
  it('gibt jede Stille-Laenge nur einmal zurueck, sortiert', () => {
    const plan = buildConcatPlan([{ speaker: 'A' }, { speaker: 'A' }, { speaker: 'B' }, { speaker: 'A' }]);
    expect(distinctSilenceDurations(plan)).toEqual([300, 600]);
  });
});
