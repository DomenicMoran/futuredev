export interface VisibleLessonItem {
  sectionKey: string;
  itemIndex: number;
  isViewable: boolean;
}

export interface LessonJumpTarget {
  sectionKey: string;
  itemIndex: number;
}

export interface MeasurableJumpView {
  measureInWindow(callback: (x: number, y: number) => void): void;
}

/** SectionList/VirtualizedList refs are not measurable; only native View hosts expose measureInWindow. */
export function isMeasurableJumpView(view: unknown): view is MeasurableJumpView {
  return typeof view === 'object' && view !== null && typeof (view as MeasurableJumpView).measureInWindow === 'function';
}

export function lessonJumpTargetKey(target: LessonJumpTarget): string {
  return `${target.sectionKey}:${target.itemIndex}`;
}

/** Async measure/settle paths must match the same pending scroll object, not just the same section row. */
export function isActiveLessonJumpScrollTarget(
  pending: LessonJumpTarget | null,
  target: LessonJumpTarget,
): boolean {
  return pending !== null && pending === target;
}

/** Measures the registered rendered row against the list viewport, then settles only the same pending target. */
export function measureLessonJumpTargetAlignment(
  target: LessonJumpTarget,
  getPendingTarget: () => LessonJumpTarget | null,
  measurementInFlight: { current: string | null },
  anchors: ReadonlyMap<string, MeasurableJumpView>,
  viewport: MeasurableJumpView | null,
  onAligned: () => void,
  onNeedsCorrection?: (scrollDelta: number) => void,
): void {
  const targetKey = lessonJumpTargetKey(target);
  if (!isActiveLessonJumpScrollTarget(getPendingTarget(), target)) return;
  if (measurementInFlight.current === targetKey) return;
  const anchor = anchors.get(targetKey);
  if (!isMeasurableJumpView(anchor) || !isMeasurableJumpView(viewport)) return;
  measurementInFlight.current = targetKey;
  anchor.measureInWindow((_x, anchorY) => {
    if (!isMeasurableJumpView(viewport)) {
      if (measurementInFlight.current === targetKey) measurementInFlight.current = null;
      return;
    }
    viewport.measureInWindow((_viewportX, viewportY) => {
      if (measurementInFlight.current === targetKey) measurementInFlight.current = null;
      if (!isActiveLessonJumpScrollTarget(getPendingTarget(), target)) return;
      const relativeTop = anchorY - viewportY;
      if (isLessonJumpTargetAligned(relativeTop)) {
        onAligned();
        return;
      }
      const scrollDelta = lessonJumpScrollCorrectionDelta(relativeTop);
      if (scrollDelta !== null) onNeedsCorrection?.(scrollDelta);
    });
  });
}

export interface LessonSectionAnchor {
  kind: 'lesson-section-anchor';
  title: string;
}

export function visibleSpeechBlockTarget(
  blockIndex: number,
  blocks: { role?: string; text: string }[],
  faq: { question: string; answer: string }[],
): { sectionKey: 'body' | 'faq'; itemIndex: number } {
  const block = blocks[blockIndex];
  if (block?.role === 'faq') {
    const faqIndex = faq.findIndex((entry) => entry.question === block.text || entry.answer === block.text);
    return faq.length === 0
      ? { sectionKey: 'body', itemIndex: blockIndex }
      : { sectionKey: 'faq', itemIndex: faqIndex < 0 ? 0 : faqIndex + 1 };
  }
  if (block && !block.text.trim()) {
    const nextVisible = blocks.findIndex((candidate, index) => index > blockIndex && candidate.role !== 'faq' && candidate.text.trim().length > 0);
    if (nextVisible >= 0) return { sectionKey: 'body', itemIndex: nextVisible };
    for (let index = blockIndex - 1; index >= 0; index -= 1) {
      const previous = blocks[index];
      if (previous && previous.role !== 'faq' && previous.text.trim().length > 0) return { sectionKey: 'body', itemIndex: index };
    }
  }
  return { sectionKey: 'body', itemIndex: blockIndex };
}

export function anchoredSectionRows<T>(title: string, items: T[]): (LessonSectionAnchor | T)[] {
  return [{ kind: 'lesson-section-anchor', title }, ...items];
}

/** Virtualized jumps remain pending until their exact section/item is visible. */
export function isLessonJumpTargetVisible(items: VisibleLessonItem[], target: LessonJumpTarget): boolean {
  return items.some((item) =>
    item.isViewable && item.sectionKey === target.sectionKey && item.itemIndex === target.itemIndex,
  );
}

/** Visibility alone is too weak: jump headings should settle near the list's unobscured top edge. */
export function isLessonJumpTargetAligned(relativeTop: number, tolerance = 24): boolean {
  return Number.isFinite(relativeTop) && relativeTop >= -8 && relativeTop <= tolerance;
}

/** Scroll offset delta that lines the measured row top up with the list viewport top. */
export function lessonJumpScrollCorrectionDelta(relativeTop: number, tolerance = 24): number | null {
  if (!Number.isFinite(relativeTop) || isLessonJumpTargetAligned(relativeTop, tolerance)) return null;
  return relativeTop;
}

export interface ReadCompletionState {
  done: boolean;
  inFlight: boolean;
}

/** Persistence is retryable after failure and serialized against duplicate taps. */
export async function persistReadCompletion(
  state: ReadCompletionState,
  persist: () => Promise<void>,
): Promise<'saved' | 'failed' | 'already-saved' | 'in-flight'> {
  if (state.done) return 'already-saved';
  if (state.inFlight) return 'in-flight';
  state.inFlight = true;
  try {
    await persist();
    state.done = true;
    return 'saved';
  } catch {
    return 'failed';
  } finally {
    state.inFlight = false;
  }
}
