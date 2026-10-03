// @ts-expect-error Node APIs run only in Vitest, not the native TypeScript runtime.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('native accessibility regression contracts', () => {
  it('exposes flashcard content, not just the flip action', () => {
    const screen = source('../../app/flashcards/index.tsx');
    expect(screen).toContain('accessibilityLabel={`${progressLabel}. ${flipped ? card.definition : card.term}`}');
    expect(screen).toContain('accessibilityState={{ expanded: flipped }}');
    expect(screen).toContain('accessibilityLiveRegion="polite"');
  });

  it('exposes checked quiz choices and announces new questions', () => {
    const screen = source('../quiz/QuizRunner.tsx');
    expect(screen).toContain('checked: isChosen');
    expect(screen).toContain('accessibilityRole="header" accessibilityLiveRegion="polite"');
  });

  it('keeps collapsed player controls out of the focus order and avoids a fixed expanded height', () => {
    const screen = source('../player/PlayerAdvancedControls.tsx');
    expect(screen).toContain("importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}");
    expect(screen).toContain('maxHeight: open ? undefined : 0');
  });

  it('does not group modal forms into one inaccessible backdrop button', () => {
    const screen = source('../components/PlaylistsSection.tsx');
    expect(screen.match(/<Pressable accessible=\{false\} style=\{styles.modalBackdrop\}/g)).toHaveLength(2);
    expect(screen).toContain('accessibilityState={{ expanded }}');
    expect(screen).toContain('<ScrollView keyboardShouldPersistTaps="handled">');
  });
});
