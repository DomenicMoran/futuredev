import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Moon, Pause, Play, Rewind, FastForward, BookOpen, X } from 'lucide-react-native';
import { useTheme } from '../src/theme/useTheme.js';
import { de } from '../src/i18n/de.js';
import { usePlayerStore } from '../src/player/store.js';
import { currentItem } from '../src/player/queue.js';
import {
  JUMP_BACKWARD_SECONDS,
  JUMP_FORWARD_SECONDS,
  SLEEP_TIMER_PRESET_MINUTES,
  type CueBlock,
} from '../src/player/types.js';
import { RATE_OPTIONS } from '../src/player/rate.js';
import {
  jumpBackward,
  jumpForward,
  removeFromQueue,
  seekToBlock,
  setRate,
  setSleepTimer,
  skipToNext,
  skipToPrevious,
} from '../src/player/index.js';

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

function formatTime(seconds: number): string {
  const total = Math.max(Math.round(seconds), 0);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const theme = useTheme();
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionSeconds = usePlayerStore((s) => s.positionSeconds);
  const rate = usePlayerStore((s) => s.rate);
  const cueSheetByLessonId = usePlayerStore((s) => s.cueSheetByLessonId);
  const item = currentItem(queue);
  const cueSheet = item ? cueSheetByLessonId[item.lessonId] : undefined;

  const [ratePickerOpen, setRatePickerOpen] = useState(false);
  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    // Schließt sich, wenn keine Lektion mehr geladen ist (etwa nach dem
    // Entfernen des letzten Titels aus der Warteschlange).
    if (!item) router.back();
  }, [item]);

  if (!item) return null;

  const progress = item.durationSeconds > 0 ? Math.min(positionSeconds / item.durationSeconds, 1) : 0;
  const currentBlockIndex = cueSheet
    ? [...cueSheet.blocks].reverse().find((b) => b.startSeconds <= positionSeconds)?.index
    : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.base }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          hitSlop={12}
          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}
        >
          <ChevronDown color={theme.colors.text} size={26} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: theme.spacing.lg }]}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.badgeText, { color: theme.colors.accentText }]}>{de.player.aiVoiceLabel}</Text>
          </View>
        </View>

        {/* Fortschrittsleiste mit Kapitelmarken je Sprechblock */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.accent }]} />
            {cueSheet
              ? cueSheet.blocks.map((block) => (
                  <View
                    key={block.index}
                    style={[
                      styles.chapterMark,
                      {
                        left: `${(block.startSeconds / Math.max(item.durationSeconds, 1)) * 100}%`,
                        backgroundColor: theme.colors.bg,
                      },
                    ]}
                  />
                ))
              : null}
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: theme.colors.textWeak }]}>{formatTime(positionSeconds)}</Text>
            <Text style={[styles.time, { color: theme.colors.textWeak }]}>{formatTime(item.durationSeconds)}</Text>
          </View>
        </View>

        {/* Steuerung: 15 s zurück, Play/Pause, 30 s vor, Vorherige/Nächste */}
        <View style={styles.controls}>
          <Pressable
            onPress={() => void skipToPrevious()}
            accessibilityRole="button"
            accessibilityLabel={de.player.previous}
            hitSlop={8}
            style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft color={theme.colors.text} size={24} />
          </Pressable>
          <Pressable
            onPress={() => void jumpBackward(JUMP_BACKWARD_SECONDS)}
            accessibilityRole="button"
            accessibilityLabel={de.player.jumpBackward}
            hitSlop={8}
            style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Rewind color={theme.colors.text} size={26} />
          </Pressable>
          <Pressable
            onPress={() => void togglePlayback(isPlaying)}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? de.player.pause : de.player.play}
            style={[
              styles.playButton,
              { backgroundColor: theme.colors.accent, minWidth: 64, minHeight: 64, borderRadius: 32 },
            ]}
          >
            {isPlaying ? (
              <Pause color={theme.colors.accentText} size={28} fill={theme.colors.accentText} />
            ) : (
              <Play color={theme.colors.accentText} size={28} fill={theme.colors.accentText} />
            )}
          </Pressable>
          <Pressable
            onPress={() => void jumpForward(JUMP_FORWARD_SECONDS)}
            accessibilityRole="button"
            accessibilityLabel={de.player.jumpForward}
            hitSlop={8}
            style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <FastForward color={theme.colors.text} size={26} />
          </Pressable>
          <Pressable
            onPress={() => void skipToNext()}
            accessibilityRole="button"
            accessibilityLabel={de.player.next}
            hitSlop={8}
            style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight color={theme.colors.text} size={24} />
          </Pressable>
        </View>

        {/* Tempo und Schlaf-Timer */}
        <View style={styles.settingsRow}>
          <Pressable
            onPress={() => setRatePickerOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${de.player.rate}: ${rate.toFixed(1)}×`}
            style={[styles.pill, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
          >
            <Text style={{ color: theme.colors.text }}>{de.player.rate}: {rate.toFixed(1)}×</Text>
          </Pressable>
          <Pressable
            onPress={() => setSleepPickerOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={de.player.sleepTimer}
            style={[styles.pill, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
          >
            <Moon color={theme.colors.text} size={16} />
            <Text style={{ color: theme.colors.text }}> {de.player.sleepTimer}</Text>
          </Pressable>
        </View>

        {ratePickerOpen ? (
          <View style={[styles.optionRow, { borderColor: theme.colors.border }]}>
            {RATE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  void setRate(option);
                  setRatePickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Tempo ${option.toFixed(1)}`}
                style={[
                  styles.option,
                  { backgroundColor: option === rate ? theme.colors.accent : 'transparent', minHeight: theme.minTapTarget },
                ]}
              >
                <Text style={{ color: option === rate ? theme.colors.accentText : theme.colors.text }}>
                  {option.toFixed(1)}×
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {sleepPickerOpen ? (
          <View style={[styles.optionRow, { borderColor: theme.colors.border }]}>
            <Pressable
              onPress={() => {
                setSleepTimer(null);
                setSleepPickerOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={de.player.sleepTimerOff}
              style={[styles.option, { minHeight: theme.minTapTarget }]}
            >
              <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerOff}</Text>
            </Pressable>
            {SLEEP_TIMER_PRESET_MINUTES.map((minutes) => (
              <Pressable
                key={minutes}
                onPress={() => {
                  setSleepTimer({ kind: 'minutes', minutes });
                  setSleepPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={de.player.sleepTimerMinutes(minutes)}
                style={[styles.option, { minHeight: theme.minTapTarget }]}
              >
                <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerMinutes(minutes)}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setSleepTimer({ kind: 'endOfLesson' });
                setSleepPickerOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={de.player.sleepTimerEndOfLesson}
              style={[styles.option, { minHeight: theme.minTapTarget }]}
            >
              <Text style={{ color: theme.colors.text }}>{de.player.sleepTimerEndOfLesson}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: item.lessonId, block: String(currentBlockIndex ?? 0) } })}
          accessibilityRole="button"
          accessibilityLabel={de.player.readInText}
          style={[styles.pill, { borderColor: theme.colors.border, alignSelf: 'flex-start', minHeight: theme.minTapTarget }]}
        >
          <BookOpen color={theme.colors.text} size={16} />
          <Text style={{ color: theme.colors.text }}> {de.player.readInText}</Text>
        </Pressable>

        {/* Kapitelliste */}
        {cueSheet ? (
          <View style={styles.chapterList}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textWeak }]}>{de.player.chapters}</Text>
            {cueSheet.blocks.map((block: CueBlock) => (
              <Pressable
                key={block.index}
                onPress={() => void seekToBlock(item.lessonId, block.index)}
                accessibilityRole="button"
                accessibilityLabel={`Sprecher ${block.speaker}, ${formatTime(block.startSeconds)}`}
                style={[
                  styles.chapterItem,
                  {
                    minHeight: theme.minTapTarget,
                    borderLeftColor: block.isKeySentence ? theme.colors.accent : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.chapterSpeaker, { color: theme.colors.textWeak }]}>{block.speaker}</Text>
                <Text style={[styles.chapterTime, { color: theme.colors.textWeak }]}>{formatTime(block.startSeconds)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Warteschlange */}
        <View style={styles.chapterList}>
          <Pressable onPress={() => setQueueOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={de.player.queue}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textWeak }]}>
              {de.player.queue} ({queue.items.length})
            </Text>
          </Pressable>
          {queueOpen ? (
            <FlatList
              data={queue.items}
              keyExtractor={(i) => i.lessonId}
              scrollEnabled={false}
              renderItem={({ item: qItem, index }) => (
                <View style={[styles.chapterItem, { minHeight: theme.minTapTarget }]}>
                  <Text
                    style={{
                      color: index === queue.currentIndex ? theme.colors.accent : theme.colors.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {qItem.title}
                  </Text>
                  <Pressable
                    onPress={() => void removeFromQueue(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${de.player.remove}: ${qItem.title}`}
                    hitSlop={8}
                  >
                    <X color={theme.colors.textWeak} size={18} />
                  </Pressable>
                </View>
              )}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 8 },
  scrollContent: { paddingBottom: 48 },
  titleBlock: { alignItems: 'center', gap: 8, marginTop: 8 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  progressRow: { marginTop: 32 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'visible' },
  progressFill: { height: 4, borderRadius: 2 },
  chapterMark: { position: 'absolute', top: -2, width: 2, height: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 },
  playButton: { alignItems: 'center', justifyContent: 'center' },
  settingsRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  option: { paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  chapterList: { marginTop: 32 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
    borderLeftWidth: 3,
  },
  chapterSpeaker: { width: 20, fontWeight: '600' },
  chapterTime: { flex: 1 },
});
