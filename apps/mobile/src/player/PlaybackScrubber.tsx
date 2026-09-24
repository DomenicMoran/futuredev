import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/useTheme.js';
import { formatPlaybackTime } from './formatTime.js';
import { positionFromRatio, ratioFromPosition, ratioFromTouchX } from './scrubberMath.js';

export interface ChapterMark {
  readonly startSeconds: number;
}

export interface PlaybackScrubberProps {
  readonly durationSeconds: number;
  readonly positionSeconds: number;
  readonly chapterMarks?: readonly ChapterMark[];
  readonly onSeekCommit: (seconds: number) => void;
  readonly variant?: 'full' | 'mini';
  readonly showTimes?: boolean;
  readonly accessibilityLabel?: string;
}

const FULL_TRACK_HEIGHT = 4;
const FULL_HIT_HEIGHT = 44;
const MINI_TRACK_HEIGHT = 3;
const MINI_HIT_HEIGHT = 44;
const THUMB_SIZE_FULL = 14;

export function PlaybackScrubber({
  durationSeconds,
  positionSeconds,
  chapterMarks = [],
  onSeekCommit,
  variant = 'full',
  showTimes = variant === 'full',
  accessibilityLabel = 'Wiedergabefortschritt',
}: PlaybackScrubberProps) {
  const theme = useTheme();
  const trackWidthRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);

  const displayRatio = isScrubbing ? scrubRatio : ratioFromPosition(positionSeconds, durationSeconds);
  const previewSeconds = positionFromRatio(displayRatio, durationSeconds);

  const commitRatio = useCallback(
    (ratio: number) => {
      onSeekCommit(positionFromRatio(ratio, durationSeconds));
    },
    [durationSeconds, onSeekCommit],
  );

  const updateFromLocalX = useCallback((localX: number) => {
    setScrubRatio(ratioFromTouchX(localX, trackWidthRef.current));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => durationSeconds > 0,
        onMoveShouldSetPanResponder: () => durationSeconds > 0,
        onPanResponderGrant: (evt) => {
          setIsScrubbing(true);
          updateFromLocalX(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          updateFromLocalX(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: (evt) => {
          const ratio = ratioFromTouchX(evt.nativeEvent.locationX, trackWidthRef.current);
          commitRatio(ratio);
          setIsScrubbing(false);
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
        },
      }),
    [commitRatio, durationSeconds, updateFromLocalX],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const step = Math.max(durationSeconds * 0.05, 5);
    let next = previewSeconds;
    if (event.nativeEvent.actionName === 'increment') next += step;
    if (event.nativeEvent.actionName === 'decrement') next -= step;
    commitRatio(ratioFromPosition(next, durationSeconds));
  };

  const trackHeight = variant === 'full' ? FULL_TRACK_HEIGHT : MINI_TRACK_HEIGHT;
  const hitHeight = variant === 'full' ? FULL_HIT_HEIGHT : MINI_HIT_HEIGHT;
  const showThumb = isScrubbing && variant === 'full';

  return (
    <View style={styles.wrap}>
      {showTimes ? (
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: theme.colors.textWeak }]}>{formatPlaybackTime(previewSeconds)}</Text>
          <Text style={[styles.time, { color: theme.colors.textWeak }]}>{formatPlaybackTime(durationSeconds)}</Text>
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: 0,
          max: Math.round(durationSeconds),
          now: Math.round(previewSeconds),
          text: `${formatPlaybackTime(previewSeconds)} von ${formatPlaybackTime(durationSeconds)}`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Vorwärts' },
          { name: 'decrement', label: 'Zurück' },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}
        style={[styles.hitArea, { minHeight: hitHeight, justifyContent: 'center' }]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.track,
            {
              height: trackHeight,
              borderRadius: trackHeight / 2,
              backgroundColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${displayRatio * 100}%`,
                backgroundColor: theme.colors.accent,
                height: trackHeight,
                borderRadius: trackHeight / 2,
              },
            ]}
          />
          {chapterMarks.map((mark, index) => (
            <View
              key={`${mark.startSeconds}-${index}`}
              style={[
                styles.chapterMark,
                {
                  left: `${(mark.startSeconds / Math.max(durationSeconds, 1)) * 100}%`,
                  backgroundColor: theme.colors.bg,
                  height: trackHeight + 4,
                  top: -2,
                },
              ]}
            />
          ))}
          {showThumb ? (
            <View
              style={[
                styles.thumb,
                {
                  left: `${displayRatio * 100}%`,
                  width: THUMB_SIZE_FULL,
                  height: THUMB_SIZE_FULL,
                  marginLeft: -THUMB_SIZE_FULL / 2,
                  borderRadius: THUMB_SIZE_FULL / 2,
                  backgroundColor: theme.colors.accent,
                  top: (trackHeight - THUMB_SIZE_FULL) / 2,
                },
              ]}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  hitArea: { width: '100%' },
  track: { width: '100%', overflow: 'visible', position: 'relative' },
  fill: {},
  chapterMark: { position: 'absolute', width: 2 },
  thumb: { position: 'absolute' },
});
