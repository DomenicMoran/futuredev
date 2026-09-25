import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SlideInBottom } from '../motion/SlideInBottom.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { FastForward, Pause, Play, X } from 'lucide-react-native';
import { clearPlayback } from './index.js';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import { ModuleCover } from '../components/ModuleCover.js';
import { tabBarHeight } from '../navigation/tabBarMetrics.js';
import { isTabBarVisible } from '../navigation/tabBarVisibility.js';
import {
  MINI_PLAYER_PLAY_BUTTON_SIZE,
  miniPlayerPaddingBottom,
  miniPlayerPaddingTop,
  miniPlayerRowMinHeight,
} from './miniPlayerLayout.js';
import { usePlayerStore } from './store.js';
import { currentItem } from './queue.js';
import { formatPlaybackTime } from './formatTime.js';
import { PlaybackScrubber } from './PlaybackScrubber.js';
import { JUMP_FORWARD_SECONDS } from './types.js';
import { jumpForward, seekToSeconds } from './index.js';

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

function moduleIdFromLessonId(lessonId: string): string {
  const dash = lessonId.indexOf('-');
  return dash > 0 ? lessonId.slice(0, dash) : lessonId;
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

  const onSeekCommit = useCallback((seconds: number) => {
    void seekToSeconds(seconds);
  }, []);

  const confirmDismissQueue = useCallback(() => {
    Alert.alert(de.player.dismissQueueTitle, de.player.dismissQueueBody, [
      { text: de.player.dismissQueueCancel, style: 'cancel' },
      {
        text: de.player.dismissQueueConfirm,
        style: 'destructive',
        onPress: () => {
          void clearPlayback();
        },
      },
    ]);
  }, []);

  if (!item) return null;

  const timeSubtitle = `${formatPlaybackTime(positionSeconds)} / ${formatPlaybackTime(item.durationSeconds)}`;
  const coverModuleId = moduleIdFromLessonId(item.lessonId);

  return (
    <SlideInBottom
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          bottom: tabBarVisible ? tabBarHeight(theme, insets.bottom) : insets.bottom,
          zIndex: 20,
        },
      ]}
    >
      <PlaybackScrubber
        durationSeconds={item.durationSeconds}
        positionSeconds={positionSeconds}
        onSeekCommit={onSeekCommit}
        variant="mini"
        showTimes={false}
      />
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: theme.spacing.base,
            paddingTop: miniPlayerPaddingTop(theme),
            paddingBottom: miniPlayerPaddingBottom(theme, tabBarVisible ? 0 : insets.bottom),
            minHeight: miniPlayerRowMinHeight(theme),
            gap: theme.spacing.md,
          },
        ]}
      >
        <Pressable
          testID="mini-player-open"
          onPress={() => router.push('/player')}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${timeSubtitle}`}
          style={({ pressed }) => [styles.mainTap, { flex: 1, opacity: pressed ? 0.92 : 1 }]}
        >
          <ModuleCover moduleId={coverModuleId} size={44} />
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
            </Text>
          </View>
        </Pressable>
        {!isPlaying ? (
          <Pressable
            onPress={confirmDismissQueue}
            accessibilityRole="button"
            accessibilityLabel={de.player.close}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              { minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <X color={theme.colors.textWeak} size={22} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void jumpForward(JUMP_FORWARD_SECONDS)}
            accessibilityRole="button"
            accessibilityLabel={de.player.jumpForward}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              { minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <FastForward color={theme.colors.textWeak} size={22} />
          </Pressable>
        )}
        <Pressable
          testID="mini-player-play-toggle"
          onPress={() => void togglePlayback(isPlaying)}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? de.player.pause : de.player.play}
          hitSlop={8}
          style={({ pressed }) => [
            styles.playButton,
            {
              backgroundColor: theme.colors.accent,
              minWidth: MINI_PLAYER_PLAY_BUTTON_SIZE,
              minHeight: MINI_PLAYER_PLAY_BUTTON_SIZE,
              width: MINI_PLAYER_PLAY_BUTTON_SIZE,
              height: MINI_PLAYER_PLAY_BUTTON_SIZE,
              borderRadius: theme.radius.full,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          {isPlaying ? (
            <Pause size={22} color={theme.colors.accentText} fill={theme.colors.accentText} />
          ) : (
            <Play size={22} color={theme.colors.accentText} fill={theme.colors.accentText} />
          )}
        </Pressable>
      </View>
    </SlideInBottom>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
