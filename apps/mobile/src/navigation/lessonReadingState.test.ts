import { describe, expect, it, vi } from 'vitest';
import { anchoredSectionRows, isActiveLessonJumpScrollTarget, isLessonJumpTargetAligned, isLessonJumpTargetVisible, isMeasurableJumpView, lessonJumpTargetKey, lessonJumpScrollCorrectionDelta, measureLessonJumpTargetAlignment, persistReadCompletion, visibleSpeechBlockTarget, type MeasurableJumpView } from './lessonReadingState.js';

describe('rendered lesson reading state', () => {
  it('keeps every FAQ answer its own virtualized row after a compact visible section anchor', () => {
    const faq = Array.from({ length: 28 }, (_, index) => ({ question: `Q${index}`, answer: 'A'.repeat(500) }));
    const rows = anchoredSectionRows('FAQ', faq);
    expect(rows).toHaveLength(faq.length + 1);
    expect(rows[0]).toEqual({ kind: 'lesson-section-anchor', title: 'FAQ' });
    expect(rows.slice(1)).toEqual(faq);
  });

  it('keeps long-list jumps pending until the exact compact section-header anchor is visible', () => {
    const target = { sectionKey: 'terms', itemIndex: 0 };
    expect(isLessonJumpTargetVisible([{ sectionKey: 'body', itemIndex: 75, isViewable: true }], target)).toBe(false);
    expect(isLessonJumpTargetVisible([{ sectionKey: 'terms', itemIndex: 1, isViewable: true }], target)).toBe(false);
    expect(isLessonJumpTargetVisible([{ sectionKey: 'terms', itemIndex: 0, isViewable: true }], target)).toBe(true);
  });

  it('treats only the same pending scroll object as the active jump target', () => {
    const pending = { sectionKey: 'faq', itemIndex: 0 };
    const other = { sectionKey: 'faq', itemIndex: 0 };
    expect(isActiveLessonJumpScrollTarget(pending, pending)).toBe(true);
    expect(isActiveLessonJumpScrollTarget(other, pending)).toBe(false);
    expect(isActiveLessonJumpScrollTarget(null, pending)).toBe(false);
  });

  it('does not mistake a visible heading near the viewport bottom for a completed jump', () => {
    expect(isLessonJumpTargetAligned(1779)).toBe(false);
    expect(isLessonJumpTargetAligned(12)).toBe(true);
    expect(isLessonJumpTargetAligned(-9)).toBe(false);
    expect(lessonJumpScrollCorrectionDelta(1779)).toBe(1779);
    expect(lessonJumpScrollCorrectionDelta(12)).toBeNull();
    expect(lessonJumpScrollCorrectionDelta(-9)).toBe(-9);
  });

  it('does not throw when the list viewport ref lacks measureInWindow', () => {
    const target = { sectionKey: 'faq', itemIndex: 0 };
    const pending = { current: target };
    const inFlight = { current: null as string | null };
    const settle = vi.fn();
    const anchor: MeasurableJumpView = { measureInWindow: (callback) => callback(0, 110) };
    const sectionListLike = { scrollToLocation: () => undefined };
    expect(isMeasurableJumpView(sectionListLike)).toBe(false);
    expect(() => measureLessonJumpTargetAlignment(
      target,
      () => pending.current,
      inFlight,
      new Map([[lessonJumpTargetKey(target), anchor]]),
      sectionListLike as unknown as MeasurableJumpView,
      settle,
    )).not.toThrow();
    expect(settle).not.toHaveBeenCalled();
    expect(inFlight.current).toBeNull();
  });

  it('requests a measured scroll correction when the FAQ header is visible but still below the reading top', () => {
    const target = { sectionKey: 'faq', itemIndex: 0 };
    const pending = { current: target };
    const inFlight = { current: null as string | null };
    const settle = vi.fn();
    const correct = vi.fn();
    const measuredAt = (y: number): MeasurableJumpView => ({ measureInWindow: (callback) => callback(0, y) });
    measureLessonJumpTargetAlignment(
      target,
      () => pending.current,
      inFlight,
      new Map([[lessonJumpTargetKey(target), measuredAt(900)]]),
      measuredAt(100),
      settle,
      correct,
    );
    expect(settle).not.toHaveBeenCalled();
    expect(correct).toHaveBeenCalledOnce();
    expect(correct).toHaveBeenCalledWith(800);
    expect(inFlight.current).toBeNull();
  });

  it.each([
    [{ sectionKey: 'body', itemIndex: 8 }, 'body:8'],
    [{ sectionKey: 'faq', itemIndex: 1 }, 'faq:1'],
    [{ sectionKey: 'faq', itemIndex: 0 }, 'faq:0'],
  ] as const)('measures and settles the rendered row for target %s', (target, key) => {
    const measuredAt = (y: number): MeasurableJumpView => ({ measureInWindow: (callback) => callback(0, y) });
    const pending = { current: target };
    const inFlight = { current: null as string | null };
    const settle = vi.fn();
    const anchors = new Map([[key, measuredAt(110)]]);
    expect(lessonJumpTargetKey(target)).toBe(key);
    measureLessonJumpTargetAlignment(target, () => pending.current, inFlight, anchors, measuredAt(100), settle);
    expect(settle).toHaveBeenCalledOnce();
    expect(inFlight.current).toBeNull();
  });

  it('does not let a callback for an earlier jump settle the currently pending target', () => {
    const oldTarget = { sectionKey: 'body', itemIndex: 8 };
    const nextTarget = { sectionKey: 'faq', itemIndex: 1 };
    type Target = typeof oldTarget | typeof nextTarget;
    let pending: Target | null = oldTarget;
    const inFlight: { current: string | null } = { current: null };
    let finishOld: ((x: number, y: number) => void) | undefined;
    const oldAnchor: MeasurableJumpView = { measureInWindow: (callback) => { finishOld = callback; } };
    const measuredAt = (y: number): MeasurableJumpView => ({ measureInWindow: (callback) => callback(0, y) });
    const settle = vi.fn();
    const anchors = new Map([[lessonJumpTargetKey(oldTarget), oldAnchor], [lessonJumpTargetKey(nextTarget), measuredAt(110)]]);
    measureLessonJumpTargetAlignment(oldTarget, () => pending, inFlight, anchors, measuredAt(100), settle);
    pending = nextTarget;
    measureLessonJumpTargetAlignment(nextTarget, () => pending, inFlight, anchors, measuredAt(100), settle);
    finishOld?.(0, 110);
    expect(settle).toHaveBeenCalledOnce();
    expect(inFlight.current).toBeNull();
  });

  it('does not settle after a manual drag cancels an in-flight anchor measurement', () => {
    const target = { sectionKey: 'faq', itemIndex: 1 };
    let pending: typeof target | null = target;
    const inFlight: { current: string | null } = { current: null };
    let finishMeasure: ((x: number, y: number) => void) | undefined;
    const anchor: MeasurableJumpView = { measureInWindow: (callback) => { finishMeasure = callback; } };
    const viewport: MeasurableJumpView = { measureInWindow: (callback) => callback(0, 100) };
    const settle = vi.fn();
    measureLessonJumpTargetAlignment(target, () => pending, inFlight, new Map([[lessonJumpTargetKey(target), anchor]]), viewport, settle);
    pending = null;
    finishMeasure?.(0, 110);
    expect(settle).not.toHaveBeenCalled();
    expect(inFlight.current).toBeNull();
  });

  it('maps spoken FAQ text to its rendered question/answer row without changing source indexes', () => {
    const blocks = [
      { text: 'body', role: 'body' },
      { text: 'Question B', role: 'faq' },
      { text: 'Answer B', role: 'faq' },
    ];
    const faq = [{ question: 'Question A', answer: 'Answer A' }, { question: 'Question B', answer: 'Answer B' }];
    expect(visibleSpeechBlockTarget(0, blocks, faq)).toEqual({ sectionKey: 'body', itemIndex: 0 });
    expect(visibleSpeechBlockTarget(2, blocks, faq)).toEqual({ sectionKey: 'faq', itemIndex: 2 });
  });

  it('maps a non-rendered whitespace speech block to the next renderable source row', () => {
    expect(visibleSpeechBlockTarget(1, [
      { text: 'Vorher', role: 'body' },
      { text: '  ', role: 'body' },
      { text: 'Nachher', role: 'body' },
    ], [])).toEqual({ sectionKey: 'body', itemIndex: 2 });
  });

  it('requires the deliberate completion action, keeps persistence failures retryable, and blocks duplicate writes', async () => {
    const state = { done: false, inFlight: false };
    let unblock: (() => void) | undefined;
    const first = persistReadCompletion(state, () => new Promise<void>((_, reject) => {
      unblock = () => reject(new Error('write failure'));
    }));
    expect(state.inFlight).toBe(true);
    expect(await persistReadCompletion(state, async () => undefined)).toBe('in-flight');
    unblock?.();
    expect(await first).toBe('failed');
    expect(state).toEqual({ done: false, inFlight: false });
    expect(await persistReadCompletion(state, async () => undefined)).toBe('saved');
    expect(await persistReadCompletion(state, async () => undefined)).toBe('already-saved');
  });
});
