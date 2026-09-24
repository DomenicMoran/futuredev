import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Dumbbell, Headphones, Layers, MessageCircleQuestion } from 'lucide-react-native';
import { isDue } from '@futuredev/core';
import { useTheme } from '../../src/theme/useTheme.js';
import { de } from '../../src/i18n/de.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { loadReviewCards } from '../../src/review/cards.js';
import { dailyRationSize, selectDailyRation } from '../../src/review/dailyRation.js';
import { pickReviewLesson } from '../../src/review/reviewRound.js';
import { knownLessonIds } from '../../src/quiz/content.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { FadeInUp } from '../../src/motion/FadeInUp.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';
import { motionStaggerDelay } from '../../src/motion/stagger.js';
import modulesFile from '../../../../content/modules.json';

export default function UebenScreen() {
  const theme = useTheme();
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const reviewIntensity = useSettingsStore((s) => s.reviewIntensity);
  const [rationCount, setRationCount] = useState<number | null>(null);
  const [totalDueCount, setTotalDueCount] = useState<number | null>(null);
  const [rationLessonId, setRationLessonId] = useState<string | null>(null);
  const [wiederholenLessonId, setWiederholenLessonId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [publishedLessonIds, setPublishedLessonIds] = useState<string[]>([]);
  const bottomInset = useBottomChromeInset();
  const inset = theme.spacing.base;

  const examModules = useMemo(() => {
    const published = new Set(publishedLessonIds.map((id) => id.slice(0, 3)));
    return modulesFile.modules.filter((module) => published.has(module.id));
  }, [publishedLessonIds]);

  const refresh = useCallback(() => {
    let cancelled = false;
    setRefreshing(true);
    loadReviewCards()
      .then((cards) => {
        if (cancelled) return;
        const now = new Date();
        const dueCards = cards.filter((c) => isDue(c, now));
        const dueTotal = dueCards.length;
        const size = dailyRationSize(dailyGoalMinutes, reviewIntensity);
        const ration = selectDailyRation(cards, size, now);
        setTotalDueCount(dueTotal);
        setRationCount(ration.length);
        setRationLessonId(pickReviewLesson(ration));
        setWiederholenLessonId(pickReviewLesson(dueCards));
      })
      .catch(() => {
        if (!cancelled) {
          setRationCount(0);
          setTotalDueCount(0);
          setRationLessonId(null);
          setWiederholenLessonId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    knownLessonIds()
      .then((ids) => {
        if (!cancelled) setPublishedLessonIds(ids);
      })
      .catch(() => {
        if (!cancelled) setPublishedLessonIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dailyGoalMinutes, reviewIntensity]);

  useFocusEffect(refresh);

  const sameReviewLesson =
    rationLessonId !== null && wiederholenLessonId !== null && rationLessonId === wiederholenLessonId;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={{ paddingHorizontal: inset, paddingBottom: bottomInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <TabScreenTitle title={de.ueben.title} />
      <FadeInUp durationMs={200} delayMs={motionStaggerDelay(0)}>
      <SectionHeader title={de.ueben.sectionHeute} theme={theme} />
      {rationCount === null ? null : rationCount === 0 ? (
        <CalmCard
          title={de.ueben.heuteEmptyTitle}
          body={de.ueben.heuteEmptyBody}
          theme={theme}
        />
      ) : (
        <ActionCard
          title={de.ueben.dailyRationTitle}
          body={
            sameReviewLesson
              ? `${de.ueben.dailyRationBody(rationCount)} ${de.ueben.dailyRationScopeNote}`
              : de.ueben.dailyRationBody(rationCount)
          }
          actionLabel={de.ueben.startDailyRation}
          onAction={() => rationLessonId && router.push(`/quiz/${rationLessonId}`)}
          disabled={!rationLessonId}
          theme={theme}
        />
      )}

      <SectionHeader title={de.ueben.sectionFlashcards} theme={theme} topGap />
      <ActionCard
        title={de.ueben.sectionFlashcards}
        body={de.ueben.flashcardsBody}
        actionLabel={de.ueben.flashcardsOpen}
        onAction={() => router.push('/flashcards')}
        theme={theme}
        Icon={Layers}
      />

      <SectionHeader title={de.ueben.sectionWiederholen} theme={theme} topGap />
      {totalDueCount === null ? null : totalDueCount === 0 ? (
        <CalmCard title={de.ueben.emptyTitle} body={de.ueben.wiederholenEmptyTip} theme={theme} />
      ) : (
        <ActionCard
          title={de.ueben.sectionWiederholen}
          body={
            sameReviewLesson
              ? `${de.ueben.wiederholenDueBody(totalDueCount)} ${de.ueben.wiederholenAllDueNote}`
              : de.ueben.wiederholenDueBody(totalDueCount)
          }
          actionLabel={de.ueben.wiederholenStart}
          onAction={() => wiederholenLessonId && router.push(`/quiz/${wiederholenLessonId}`)}
          disabled={!wiederholenLessonId}
          theme={theme}
          Icon={Dumbbell}
        />
      )}

      <SectionHeader title={de.ueben.sectionPruefungen} theme={theme} topGap />
      <View
        style={[
          styles.listCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
        ]}
      >
        <ExamRow
          label={de.ueben.examAllRow}
          onPress={() => router.push('/quiz/exam?scope=all')}
          theme={theme}
          first
        />
        {examModules.map((module, idx) => (
          <ExamRow
            key={module.id}
            label={module.title}
            onPress={() => router.push(`/quiz/exam?scope=module:${module.id}`)}
            theme={theme}
            last={idx === examModules.length - 1}
          />
        ))}
      </View>

      <SectionHeader title={de.ueben.sectionErklaeren} theme={theme} topGap />
      <LinkCard
        title={de.ueben.explainExamTitle}
        body={de.ueben.explainExamBody}
        onPress={() => router.push('/erklaer')}
        accessibilityLabel={de.ueben.explainExamAction}
        theme={theme}
        Icon={MessageCircleQuestion}
      />

      <SectionHeader title={de.ueben.sectionHoerenClips} theme={theme} topGap />
      <LinkCard
        title={de.ueben.reviewClipsTitle}
        body={de.ueben.reviewClipsBody}
        onPress={() => router.push('/(tabs)/hoeren')}
        accessibilityLabel={de.ueben.reviewClipsAction}
        theme={theme}
        Icon={Headphones}
        accentBar
      />
      </FadeInUp>
    </ScrollView>
  );
}

function SectionHeader({
  title,
  theme,
  topGap,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>;
  topGap?: boolean;
}) {
  return (
    <Text
      style={[
        styles.sectionTitle,
        { color: theme.colors.text, marginTop: topGap ? theme.spacing.lg : theme.spacing.sm, marginBottom: theme.spacing.sm },
      ]}
    >
      {title}
    </Text>
  );
}

function CalmCard({ title, body, theme }: { title: string; body: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.spacing.base },
      ]}
    >
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>{body}</Text>
    </View>
  );
}

function ActionCard({
  title,
  body,
  actionLabel,
  onAction,
  disabled,
  theme,
  Icon,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  theme: ReturnType<typeof useTheme>;
  Icon?: typeof Dumbbell;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.spacing.base },
      ]}
    >
      {Icon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
          <Icon color={theme.colors.accent} size={24} strokeWidth={1.75} />
          <Text style={[styles.cardTitle, { color: theme.colors.text, flex: 1 }]}>{title}</Text>
        </View>
      ) : (
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
      )}
      <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: Icon ? 0 : theme.spacing.xs }]}>{body}</Text>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        disabled={disabled}
        style={[
          styles.primaryButton,
          {
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.md,
            marginTop: theme.spacing.base,
            minHeight: theme.minTapTarget,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{actionLabel}</Text>
      </PressableFeedback>
    </View>
  );
}

function LinkCard({
  title,
  body,
  onPress,
  accessibilityLabel,
  theme,
  Icon,
  accentBar,
}: {
  title: string;
  body: string;
  onPress: () => void;
  accessibilityLabel: string;
  theme: ReturnType<typeof useTheme>;
  Icon: typeof Headphones;
  accentBar?: boolean;
}) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderLeftColor: accentBar ? theme.colors.accent : theme.colors.border,
          borderLeftWidth: accentBar ? 3 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Icon color={theme.colors.accent} size={28} strokeWidth={1.75} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>{body}</Text>
      </View>
    </PressableFeedback>
  );
}

function ExamRow({
  label,
  onPress,
  theme,
  first,
  last,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.examRow,
        {
          borderColor: theme.colors.border,
          minHeight: theme.minTapTarget,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.examRowLabel, { color: theme.colors.text }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  primaryButton: { justifyContent: 'center', alignItems: 'center' },
  primaryButtonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  listCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  examRow: { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  examRowLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
});
