import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme.js';
import { usePlayerStore } from '../player/store.js';
import { currentItem } from '../player/queue.js';
import { miniPlayerHeight, tabBarHeight } from './tabBarMetrics.js';
import { isTabBarVisible } from './tabBarVisibility.js';

/** Unterer Freiraum, damit Inhalte nicht unter Reiterleiste + Mini-Player liegen. */
export function useBottomChromeInset(): number {
  const theme = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabBarVisible = isTabBarVisible(pathname);
  const queue = usePlayerStore((s) => s.queue);
  const hasMiniPlayer = currentItem(queue) !== null;
  const tabBar = tabBarVisible ? tabBarHeight(theme) : 0;
  const miniPlayer = hasMiniPlayer ? miniPlayerHeight(theme) : 0;
  const miniPlayerSafeGap = hasMiniPlayer && !tabBarVisible ? insets.bottom : 0;
  return tabBar + miniPlayer + miniPlayerSafeGap + theme.spacing.sm;
}
