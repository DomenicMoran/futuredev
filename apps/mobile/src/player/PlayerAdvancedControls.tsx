import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Moon,
  Repeat,
  Repeat1,
  X,
} from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import { usePlayerStore } from './store.js';
import { RATE_OPTIONS } from './rate.js';
import { SLEEP_TIMER_PRESET_MINUTES } from './types.js';
import { applyRepeatMode, removeFromQueue, setRate, setSleepTimer, skipToNext, skipToPrevious } from './index.js';
import { nextRepeatMode } from './playbackEnd.js';

function repeatSummaryLabel(mode: ReturnType<typeof usePlayerStore.getState>['repeatMode']): string {
  if (mode === 'one') return de.player.repeatOne;
  if (mode === 'all') return de.player.repeatAll;
  return de.player.repeatOff;
}

export function PlayerAdvancedControls() {
  const theme = useTheme();
  const queue = usePlayerStore((s) => s.queue);
  const rate = usePlayerStore((s) => s.rate);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const [open, setOpen] = useState(false);
  const [ratePickerOpen, setRatePickerOpen] = useState(false);
  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const summary = de.player.advancedSummary(`${rate.toFixed(1)}×`, repeatSummaryLabel(repeatMode));

  return (
    <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={de.player.advancedTitle}
        style={({ pressed }) => [
          styles.accordionHeader,
          {
            borderColor: theme.colors.border,
            minHeight: theme.minTapTarget,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: theme.type.size.sm.size, fontWeight: '600' }}>
            {de.player.advancedTitle}
          </Text>
          {!open ? (
            <Text style={{ color: theme.colors.textWeak, fontSize: theme.type.size.xs.size, marginTop: 2 }}>{summary}</Text>
          ) : null}
        </View>
        {open ? (
          <ChevronUp color={theme.colors.textWeak} size={20} />
        ) : (
          <ChevronDown color={theme.colors.textWeak} size={20} />
        )}
      </Pressable>

      {open ? (
        <>
          <View style={[styles.settingsRow, { gap: theme.spacing.sm }]}>
            <Pressable
              onPress={() => void skipToPrevious()}
              accessibilityRole="button"
              accessibilityLabel={de.player.previous}
              style={({ pressed }) => [
                styles.quietPill,
                { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <ChevronLeft color={theme.colors.textWeak} size={18} />
            </Pressable>
            <Pressable
              onPress={() => void skipToNext()}
              accessibilityRole="button"
              accessibilityLabel={de.player.next}
              style={({ pressed }) => [
                styles.quietPill,
                { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <ChevronRight color={theme.colors.textWeak} size={18} />
            </Pressable>
            <Pressable
              onPress={() => setRatePickerOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`${de.player.rate}: ${rate.toFixed(1)}×`}
              style={({ pressed }) => [
                styles.quietPill,
                { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={{ color: theme.colors.textWeak, fontSize: theme.type.size.sm.size }}>{rate.toFixed(1)}×</Text>
            </Pressable>
            <Pressable
              onPress={() => void applyRepeatMode(nextRepeatMode(repeatMode))}
              accessibilityRole="button"
              accessibilityLabel={repeatSummaryLabel(repeatMode)}
              style={({ pressed }) => [
                styles.quietPill,
                {
                  borderColor: repeatMode === 'off' ? theme.colors.border : theme.colors.accent,
                  minHeight: theme.minTapTarget,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              {repeatMode === 'one' ? (
                <Repeat1 color={theme.colors.accent} size={16} />
              ) : (
                <Repeat color={repeatMode === 'all' ? theme.colors.accent : theme.colors.textWeak} size={16} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setSleepPickerOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={de.player.sleepTimer}
              style={({ pressed }) => [
                styles.quietPill,
                { borderColor: theme.colors.border, minHeight: theme.minTapTarget, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Moon color={theme.colors.textWeak} size={16} />
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
                  <Text style={{ color: option === rate ? theme.colors.accentText : theme.colors.text }}>{option.toFixed(1)}×</Text>
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

          <View style={styles.chapterList}>
            <Pressable onPress={() => setQueueOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={de.player.queue}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textWeak }]}>
                {de.player.queue} ({queue.items.length})
              </Text>
            </Pressable>
            {queueOpen
              ? queue.items.map((qItem, index) => (
                  <View key={qItem.lessonId} style={[styles.chapterItem, { minHeight: theme.minTapTarget }]}>
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
                ))
              : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 8,
  },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  quietPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  option: { paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  chapterList: {},
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
