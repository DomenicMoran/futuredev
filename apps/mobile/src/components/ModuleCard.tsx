import { useContent } from '../content/ContentProvider.js';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from '../motion/PressableFeedback.js';
import { ChevronRight, Lock } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import type { ModuleListEntry } from '../content/listLessons.js';
import { ModuleCover } from './ModuleCover.js';
import { ProgressBar } from './ProgressBar.js';
import { formatLearningDuration } from '../content/formatDuration.js';

interface ModuleCardProps {
  readonly module: ModuleListEntry;
  readonly onPress: () => void;
}

function moduleDurationMinutes(module: ModuleListEntry): number {
  let total = 0;
  for (const sub of module.subModules) {
    for (const lesson of sub.lessons) {
      total += lesson.durationMinutes;
    }
  }
  return total;
}

function ModuleCardInner({ module, onPress }: ModuleCardProps) {
  const theme = useTheme();
  const { statuses } = useContent();
  const entries = module.subModules.flatMap(sub => sub.lessons);
  const covered = entries.filter(lesson => { const status = statuses[lesson.id]; return status && (status.read || status.heard || status.done); }).length;
  const read = entries.filter(lesson => statuses[lesson.id]?.read).length;
  const heard = entries.filter(lesson => statuses[lesson.id]?.heard).length;
  const done = entries.filter(lesson => statuses[lesson.id]?.done).length;
  const hasLessons = module.totalLessons > 0;
  const progress = module.totalLessons === 0 ? 0 : covered / module.totalLessons;
  const durationMinutes = useMemo(() => moduleDurationMinutes(module), [module]);

  const progressPercent = Math.round(progress * 100);
  const meta = hasLessons
    ? `${covered} von ${module.totalLessons} bearbeitet · ${de.lernen.moduleProgressPercent(progressPercent)}`
    : `${de.lernen.inPreparation}, ${de.lernen.plannedLessons(module.subModules.length)}`;

  const durationSuffix =
    hasLessons && durationMinutes > 0 ? ` · ${formatLearningDuration(durationMinutes)} gesamt` : '';

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${module.title}. ${meta}${durationSuffix}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          padding: theme.spacing.base,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <ModuleCover moduleId={module.id} size={56} />
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
          {module.title}
        </Text>
        <Text
          style={[
            styles.meta,
            {
              color: theme.colors.textWeak,
              fontSize: theme.type.size.sm.size,
              lineHeight: theme.type.size.sm.lineHeight,
            },
          ]}
        >
          {meta}
          {durationSuffix}
        </Text>
        {hasLessons ? <Text style={{ color: theme.colors.textWeak, fontSize: 12 }}>{read} gelesen · {heard} gehört · {done} erledigt</Text> : null}
        {hasLessons ? <ProgressBar progress={progress} /> : null}
      </View>
      {hasLessons ? (
        <ChevronRight size={20} color={theme.colors.textWeak} />
      ) : (
        <Lock size={18} color={theme.colors.textWeak} accessibilityLabel={de.lernen.inPreparation} />
      )}
    </PressableFeedback>
  );
}

export const ModuleCard = memo(ModuleCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    marginBottom: 8,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontWeight: '600',
  },
  meta: {},
});
