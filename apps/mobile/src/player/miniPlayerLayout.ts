import type { Theme } from '../theme/useTheme.js';

/** Muss mit PlaybackScrubber variant=mini hitArea minHeight übereinstimmen. */
export const MINI_PLAYER_SCRUBBER_HIT_HEIGHT = 44;

/** Sichtbare Fortschrittslinie im Mini-Player (innerhalb der Hit-Area). */
export const MINI_PLAYER_PROGRESS_HEIGHT = 3;

/** Play-Button in MiniPlayer (44×44). */
export const MINI_PLAYER_PLAY_BUTTON_SIZE = 44;

/** styles.subtitle marginTop in MiniPlayer. */
export const MINI_PLAYER_SUBTITLE_MARGIN_TOP = 2;

/** Zusatz zur row minHeight neben minTapTarget + xs.lineHeight. */
export const MINI_PLAYER_ROW_EXTRA_MIN_HEIGHT = 4;

export function miniPlayerPaddingTop(theme: Theme): number {
  return theme.spacing.sm;
}

/** Entspricht MiniPlayer Pressable paddingBottom (ohne Home-Indicator-Fall: sm). */
export function miniPlayerPaddingBottom(theme: Theme, safeAreaBottom = 0): number {
  return Math.max(theme.spacing.sm, safeAreaBottom > 0 ? theme.spacing.xs : theme.spacing.sm);
}

/** minHeight der tippbaren Zeile in MiniPlayer. */
export function miniPlayerRowMinHeight(theme: Theme): number {
  return theme.minTapTarget + theme.type.size.xs.lineHeight + MINI_PLAYER_ROW_EXTRA_MIN_HEIGHT;
}

export function miniPlayerTitleBlockHeight(theme: Theme): number {
  return theme.type.size.sm.lineHeight + MINI_PLAYER_SUBTITLE_MARGIN_TOP + theme.type.size.xs.lineHeight;
}

/** Innere Zeilenhöhe: Play-Button vs. Titel+Untertitel. */
export function miniPlayerRowContentHeight(theme: Theme): number {
  return Math.max(theme.minTapTarget, miniPlayerTitleBlockHeight(theme));
}

/**
 * Gesamthöhe für Scroll-Padding (konservativ: vertikales Padding je sm).
 * Formel: Fortschritt + padding×2 + max(minTapTarget, Titel+Untertitel-Zeilen).
 */
export function miniPlayerLayoutHeight(theme: Theme): number {
  const verticalPadding = theme.spacing.sm * 2;
  const rowHeight = Math.max(miniPlayerRowMinHeight(theme), miniPlayerRowContentHeight(theme));
  return MINI_PLAYER_SCRUBBER_HIT_HEIGHT + verticalPadding + rowHeight;
}
