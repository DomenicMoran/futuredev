import { useContent } from '../content/ContentProvider.js';
import { EMPTY_LESSON_STATUS, lessonStatusLabel } from '../data/lessonStatus.js';
import { LessonStatusActions } from './LessonStatusActions.js';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import type { LessonListEntry } from '../content/listLessons.js';

interface LessonRowProps {
  readonly lesson: LessonListEntry;
  readonly onPress: () => void;
}

function LessonRowInner({ lesson, onPress }: LessonRowProps) {
  const theme = useTheme();
  const { statuses } = useContent();
  const status = statuses[lesson.id] ?? EMPTY_LESSON_STATUS;
  const stateLabel = lessonStatusLabel(status);
  const isCompleted = status.done || status.read || status.heard;

  const subtitle =
    lesson.durationMinutes > 0
      ? `${de.module.lessonDuration(lesson.durationMinutes)} · ${stateLabel}`
      : stateLabel;

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingLeft: theme.spacing.base, paddingRight: 4 }]}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}, ${subtitle}`}
      style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: theme.spacing.base, minHeight: theme.minTapTarget, opacity: pressed ? 0.96 : 1 }]}
    >
      {isCompleted ? (
        <CheckCircle2 size={20} color={theme.colors.success} />
      ) : (
        <Circle size={20} color={theme.colors.textWeak} />
      )}
      <View style={styles.textBlock}>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: theme.type.size.base.size,
              lineHeight: theme.type.size.base.lineHeight,
            },
          ]}
        >
          {lesson.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textWeak,
              fontSize: theme.type.size.sm.size,
              lineHeight: theme.type.size.sm.lineHeight,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
    <LessonStatusActions lessonId={lesson.id} title={lesson.title} compact />
    </View>
  );
}

export const LessonRow = memo(LessonRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  textBlock: { flex: 1, minWidth: 0 },
  title: { fontWeight: '600' },
  subtitle: { marginTop: 2 },
});
