import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Pause, Play } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import { usePlayerStore } from './store.js';
import { currentItem } from './queue.js';

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
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionSeconds = usePlayerStore((s) => s.positionSeconds);
  const item = currentItem(queue);

  if (!item) return null;

  const progress = item.durationSeconds > 0 ? Math.min(positionSeconds / item.durationSeconds, 1) : 0;

  return (
    <Pressable
      onPress={() => router.push('/player')}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${de.player.aiVoiceLabel}`}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          bottom: 56 + theme.spacing.xs,
        },
      ]}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.accent }]} />
      </View>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textWeak }]}>{de.player.aiVoiceLabel}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            void togglePlayback(isPlaying);
          }}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? de.player.pause : de.player.play}
          hitSlop={12}
          style={[styles.playButton, { backgroundColor: theme.colors.accent, minWidth: theme.minTapTarget, minHeight: theme.minTapTarget }]}
        >
          {isPlaying ? (
            <Pause size={20} color={theme.colors.accentText} fill={theme.colors.accentText} />
          ) : (
            <Play size={20} color={theme.colors.accentText} fill={theme.colors.accentText} />
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  playButton: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
