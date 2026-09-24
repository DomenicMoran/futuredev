import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Pause, Play } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import { usePathname } from 'expo-router';
import { tabBarHeight } from '../navigation/tabBarMetrics.js';
import { isTabBarVisible } from '../navigation/tabBarVisibility.js';
import {
  MINI_PLAYER_PLAY_BUTTON_SIZE,
  MINI_PLAYER_PROGRESS_HEIGHT,
  miniPlayerPaddingBottom,
  miniPlayerPaddingTop,
  miniPlayerRowMinHeight,
} from './miniPlayerLayout.js';
import { usePlayerStore } from './store.js';
import { currentItem } from './queue.js';
import { formatPlaybackTime } from './formatTime.js';

async function togglePlayback(isPlaying: boolean): Promise<void> {
  const trackPlayer = (await import('react-native-track-player')).default;
  if (isPlaying) {
    await trackPlayer.pause();
    usePlayerStore.getState().setPlaying(false);
  } else {
    await trackPlayer.play();
    usePlayerStore.getState().setPlaying(true);
  }
}

/**
 * Schmaler Streifen über der Reiterleiste (Vorbild
 * feedback_audio_gehoert_ins_layout: lebt im Wurzel-Layout, überlebt den
 * Reiterwechsel). Nur sichtbar, sobald eine Lektion geladen ist.
 */
export function MiniPlayer() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const tabBarVisible = isTabBarVisible(pathname);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionSeconds = usePlayerStore((s) => s.positionSeconds);
  const item = currentItem(queue);

  if (!item) return null;

  const progress = item.durationSeconds > 0 ? Math.min(positionSeconds / item.durationSeconds, 1) : 0;
  const timeSubtitle = `${formatPlaybackTime(positionSeconds)} / ${formatPlaybackTime(item.durationSeconds)}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          bottom: tabBarVisible ? tabBarHeight(theme) : insets.bottom,
          zIndex: 20,
          shadowColor: theme.colors.text,
        },
      ]}
    >
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.accent }]} />
      </View>
      <Pressable
        onPress={() => router.push('/player')}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${timeSubtitle}, ${de.player.aiVoiceLabel}`}
        style={({ pressed }) => [
          styles.row,
          {
            paddingHorizontal: theme.spacing.base,
            paddingTop: miniPlayerPaddingTop(theme),
            paddingBottom: miniPlayerPaddingBottom(theme, tabBarVisible ? 0 : insets.bottom),
            minHeight: miniPlayerRowMinHeight(theme),
            gap: theme.spacing.md,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.titleBlock}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.title,
              {
                color: theme.colors.text,
                fontSize: theme.type.size.sm.size,
                lineHeight: theme.type.size.sm.lineHeight,
              },
            ]}
          >
            {item.title}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.subtitle,
              {
                color: theme.colors.textWeak,
                fontSize: theme.type.size.xs.size,
                lineHeight: theme.type.size.xs.lineHeight,
              },
            ]}
          >
            {timeSubtitle}
            {' · '}
            {de.player.aiVoiceLabel}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            void togglePlayback(isPlaying);
          }}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? de.player.pause : de.player.play}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.playButton,
            {
              backgroundColor: theme.colors.accent,
              minWidth: MINI_PLAYER_PLAY_BUTTON_SIZE,
              minHeight: MINI_PLAYER_PLAY_BUTTON_SIZE,
              width: MINI_PLAYER_PLAY_BUTTON_SIZE,
              height: MINI_PLAYER_PLAY_BUTTON_SIZE,
              borderRadius: theme.radius.full,
            },
          ]}
        >
          {isPlaying ? (
            <Pause size={22} color={theme.colors.accentText} fill={theme.colors.accentText} />
          ) : (
            <Play size={22} color={theme.colors.accentText} fill={theme.colors.accentText} />
          )}
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  progressTrack: {
    height: MINI_PLAYER_PROGRESS_HEIGHT,
  },
  progressFill: {
    height: MINI_PLAYER_PROGRESS_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
