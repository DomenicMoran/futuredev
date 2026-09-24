import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme.js';
import { usePlayerStore } from '../player/store.js';
import { currentItem } from '../player/queue.js';
import { miniPlayerHeight, tabBarHeight } from './tabBarMetrics.js';
import { isTabBarVisible } from './tabBarVisibility.js';

export type BottomChromeLayout = {
  /** Scroll-Padding: Tab/Mini-Player + optional Safe-Area unter Mini (Stack-Routen) + Abstand. */
  contentInset: number;
  /** Unterkante der sticky Action-Leiste (ohne doppeltes Safe-Area unter Mini-Player). */
  stickyBottomOffset: number;
};

export function useBottomChromeLayout(): BottomChromeLayout {
  const theme = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const queue = usePlayerStore((s) => s.queue);
  const tabBarVisible = isTabBarVisible(pathname);
  const hasMiniPlayer = currentItem(queue) !== null;
  const tabBar = tabBarVisible ? tabBarHeight(theme, insets.bottom) : insets.bottom;
  const miniPlayer = hasMiniPlayer ? miniPlayerHeight(theme) : 0;
  // Auf Stack-Routen sitzt der Mini-Player über der Home-Indicator-Zone; contentInset zählt
  // diese Zone mit, stickyBottomOffset nicht (Leiste liegt direkt über dem Mini-Player).
  const miniPlayerSafeGap = hasMiniPlayer && !tabBarVisible ? insets.bottom : 0;
  const gap = theme.spacing.sm;
  return {
    contentInset: tabBar + miniPlayer + miniPlayerSafeGap + gap,
    stickyBottomOffset: tabBar + miniPlayer + gap,
  };
}

/** Unterer Freiraum, damit Inhalte nicht unter Reiterleiste + Mini-Player liegen. */
export function useBottomChromeInset(): number {
  return useBottomChromeLayout().contentInset;
}
