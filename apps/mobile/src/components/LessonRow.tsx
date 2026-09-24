import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import type { LessonListEntry } from '../content/listLessons.js';

interface LessonRowProps {
  readonly lesson: LessonListEntry;
  readonly onPress: () => void;
}

function stateLabelFor(state: LessonListEntry['state']): string {
  switch (state) {
    case 'new':
      return de.lernen.stateNew;
    case 'started':
      return de.lernen.stateStarted;
    case 'read':
      return de.lernen.stateRead;
    case 'listened':
      return de.lernen.stateListened;
    case 'quiz_passed':
      return de.lernen.stateQuizPassed;
    case 'completed':
      return de.lernen.stateCompleted;
  }
}

function LessonRowInner({ lesson, onPress }: LessonRowProps) {
  const theme = useTheme();
  const stateLabel = stateLabelFor(lesson.state);
  const isCompleted = lesson.state === 'completed';

  const subtitle =
    lesson.durationMinutes > 0
      ? `${de.module.lessonDuration(lesson.durationMinutes)} · ${stateLabel}`
      : stateLabel;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}, ${stateLabel}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.base,
          minHeight: theme.minTapTarget,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
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
      <ChevronRight size={20} color={theme.colors.textWeak} />
    </Pressable>
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
