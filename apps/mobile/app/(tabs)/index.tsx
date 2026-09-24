import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import { BookOpen, ChevronRight } from 'lucide-react-native';

import { useTheme } from '../../src/theme/useTheme.js';

import { EmptyState } from '../../src/components/EmptyState.js';

import { de } from '../../src/i18n/de.js';

import { useSettingsStore } from '../../src/state/settings.js';

import { loadStartData, type ContinueCard, type StartData } from '../../src/settings/startData.js';

import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

import { useContent } from '../../src/content/ContentProvider.js';

import {
  collectOrderedPublishedLessonIds,
  getFirstPublishedLessonId,
  type ModuleListEntry,
} from '../../src/content/listLessons.js';

import { openFirstPublishedLessonOrLernen } from '../../src/navigation/openFirstLesson.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { usePlayerStore } from '../../src/player/store.js';
import { currentItem } from '../../src/player/queue.js';
import { formatPlaybackTime } from '../../src/player/formatTime.js';
import { FadeInUp } from '../../src/motion/FadeInUp.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';
import { motionStaggerDelay } from '../../src/motion/stagger.js';

import {

  continueActionLabel,

  openContinueDestination,

  resolveContinueMode,

} from '../../src/settings/continueNavigation.js';



export default function StartScreen() {

  const theme = useTheme();

  const { moduleList } = useContent();

  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const dailyLearningSecondsToday = useSettingsStore((s) => s.dailyLearningSecondsToday);

  const firstFormPreference = useSettingsStore((s) => s.firstFormPreference);

  const reviewIntensity = useSettingsStore((s) => s.reviewIntensity);

  const [data, setData] = useState<StartData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const bottomInset = useBottomChromeInset();
  const queue = usePlayerStore((s) => s.queue);
  const positionSeconds = usePlayerStore((s) => s.positionSeconds);

  const orderedLessonIds = useMemo(() => collectOrderedPublishedLessonIds(moduleList), [moduleList]);
  const hasBundledModules = moduleList.length > 0;
  const hasPublishedLessons = orderedLessonIds.length > 0;

  const refresh = useCallback(() => {
    loadStartData(dailyGoalMinutes, reviewIntensity, { orderedLessonIds })
      .then((next) => {
        setData(next);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setData((prev) => prev ?? buildFallbackStartData(moduleList, orderedLessonIds));
      });
  }, [dailyGoalMinutes, reviewIntensity, moduleList, orderedLessonIds]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (hasPublishedLessons) refresh();
  }, [hasPublishedLessons, refresh]);

  const playerContinueCard = useMemo((): ContinueCard | null => {
    const item = currentItem(queue);
    if (!item) return null;
    return {
      lessonId: item.lessonId,
      lessonTitle: lessonTitleFromModules(moduleList, item.lessonId) ?? item.title,
      state: 'listened',
      positionLabel: formatPlaybackTime(positionSeconds),
      readUntil: null,
      listenedUntil: Math.round(positionSeconds),
    };
  }, [queue, moduleList, positionSeconds]);

  const continueCard = data?.continueCard ?? playerContinueCard;
  const nextLessonId =
    data?.nextLessonId ?? getFirstPublishedLessonId(moduleList) ?? orderedLessonIds[0] ?? null;
  const nextLessonTitle =
    data?.nextLessonTitle ??
    (nextLessonId ? lessonTitleFromModules(moduleList, nextLessonId) : null);

  const displayData = useMemo((): StartData | null => {
    if (data) return data;
    if (!hasPublishedLessons) return null;
    return buildFallbackStartData(moduleList, orderedLessonIds);
  }, [data, hasPublishedLessons, moduleList, orderedLessonIds]);

  const greeting = greetingForHour(new Date().getHours());

  const showEmptyState = !hasBundledModules && !continueCard && !nextLessonId;

  if (showEmptyState) {

    return (

      <ScrollView

        style={[styles.container, { backgroundColor: theme.colors.bg }]}

        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomInset }}

      >

        <TabScreenTitle title={de.start.title} />

        <EmptyState

          Icon={BookOpen}

          title={de.start.emptyTitle}

          body={de.start.emptyBody}

          actionLabel={de.start.emptyAction}

          onAction={() => openFirstPublishedLessonOrLernen(moduleList)}

        />

      </ScrollView>

    );

  }



  const continueMode = continueCard ? resolveContinueMode(continueCard.state, firstFormPreference) : null;

  const openContinue = () => {
    if (!continueCard) return;
    void openContinueDestination(continueCard, firstFormPreference);
  };

  return (

    <ScrollView

      style={[styles.container, { backgroundColor: theme.colors.bg }]}

      contentContainerStyle={{

        paddingHorizontal: theme.spacing.base,

        paddingBottom: bottomInset,

      }}

    >

      <TabScreenTitle title={de.start.title} />

      <FadeInUp durationMs={200} delayMs={motionStaggerDelay(0)}>

      {loadError ? (
        <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>
          {de.start.loadErrorHint}
        </Text>
      ) : null}

      <Text

        style={[

          styles.greeting,

          {

            color: theme.colors.text,

            marginBottom: theme.spacing.sm,

            fontSize: theme.type.size['2xl'].size,

            lineHeight: theme.type.size['2xl'].lineHeight,

          },

        ]}

      >

        {greeting}

      </Text>



      {continueCard && continueMode ? (

        <FadeInUp durationMs={200} delayMs={motionStaggerDelay(1)}>

        <PressableFeedback

          accessibilityRole="button"

          accessibilityLabel={`${continueActionLabel(continueMode)}: ${continueCard.lessonTitle}`}

          onPress={openContinue}

        >

          <Card theme={theme} title={de.start.continueTitle} emphasized>

            <Text style={[styles.cardHeadline, { color: theme.colors.text }]} numberOfLines={2}>

              {continueCard.lessonTitle}

            </Text>

            <Text style={[styles.body, { color: theme.colors.textWeak }]}>

              {continueMode === 'listen' && continueCard.positionLabel

                ? de.start.continueListenFrom(continueCard.positionLabel)

                : continueMode === 'read' && continueCard.positionLabel

                  ? de.start.continueReadFrom(continueCard.positionLabel)

                  : null}

            </Text>

            <PrimaryButton

              theme={theme}

              label={continueActionLabel(continueMode)}

              onPress={openContinue}

            />

          </Card>

        </PressableFeedback>

        </FadeInUp>

      ) : null}



      {displayData ? (

        <FadeInUp durationMs={200} delayMs={motionStaggerDelay(continueCard ? 2 : 1)}>

        <Card theme={theme} title={de.start.dailyGoalTitle}>

          {(() => {
            const seconds =
              displayData.dailyLearningSecondsToday ?? dailyLearningSecondsToday ?? null;
            if (seconds !== null) {
              const learnedMinutes = Math.floor(seconds / 60);
              const fillRatio = dailyGoalMinutes > 0 ? Math.min(1, learnedMinutes / dailyGoalMinutes) : 0;
              const goalMet = learnedMinutes >= dailyGoalMinutes;
              return (
                <>
                  <Text style={[styles.body, { color: theme.colors.text }]}>
                    {de.start.dailyGoalProgressToday(learnedMinutes, dailyGoalMinutes)}
                  </Text>
                  <View
                    style={[
                      styles.dailyGoalTrack,
                      { backgroundColor: theme.colors.border, borderRadius: theme.radius.full, marginTop: theme.spacing.sm },
                    ]}
                  >
                    <View
                      style={[
                        styles.dailyGoalFill,
                        {
                          backgroundColor: goalMet ? theme.colors.success : theme.colors.accent,
                          borderRadius: theme.radius.full,
                          width: `${Math.round(fillRatio * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  {goalMet ? (
                    <Text style={[styles.body, { color: theme.colors.success, marginTop: theme.spacing.xs, fontWeight: '600' }]}>
                      {de.start.dailyGoalMet}
                    </Text>
                  ) : null}
                </>
              );
            }
            return (
              <Text style={[styles.body, { color: theme.colors.textWeak }]}>
                {de.start.dailyGoalSettingsTip(dailyGoalMinutes)}
              </Text>
            );
          })()}

          <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>

            {displayData.dueReviewCount > 0

              ? de.start.dailyGoalDueReviews(displayData.dueReviewCount)

              : de.start.dailyRationTileEmpty}

          </Text>

        </Card>

        </FadeInUp>

      ) : null}



      {nextLessonId ? (

        <FadeInUp durationMs={200} delayMs={motionStaggerDelay(2)}>

        <Card theme={theme} title={de.start.nextRecommendationTitle}>

          <Text style={[styles.cardHeadline, { color: theme.colors.text }]} numberOfLines={2}>

            {nextLessonTitle ?? de.start.nextRecommendationFallback}

          </Text>

          <SecondaryButton

            theme={theme}

            label={de.start.nextRecommendationAction}

            onPress={() => router.push(`/lesson/${nextLessonId}`)}

          />

        </Card>

        </FadeInUp>

      ) : null}



      <FadeInUp durationMs={200} delayMs={motionStaggerDelay(2)}>

      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={de.start.dailyRationOpen}
        onPress={() => router.push('/(tabs)/ueben')}
      >

        <Card theme={theme} title={de.start.dailyRationTile}>

          <Text style={[styles.body, { color: theme.colors.textWeak }]}>

            {(displayData?.dueReviewCount ?? 0) > 0
              ? de.start.dailyRationTileBody(displayData?.dueReviewCount ?? 0)
              : de.start.dailyRationTileEmpty}

          </Text>

          <View style={styles.cardActionRow}>
            <Text style={[styles.cardActionLabel, { color: theme.colors.accent }]}>{de.start.dailyRationOpen}</Text>
            <ChevronRight color={theme.colors.accent} size={20} strokeWidth={1.75} />
          </View>

        </Card>

      </PressableFeedback>

      </FadeInUp>



      {displayData ? (

        <FadeInUp durationMs={200} delayMs={motionStaggerDelay(2)}>

        <Card theme={theme} title={de.start.weekOverviewTitle}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>

            {displayData.week.map((day) => {
              const weekdayIndex = (new Date(`${day.date}T12:00:00`).getDay() + 6) % 7;
              const weekdayLabel = de.start.weekdayShort[weekdayIndex];
              return (
                <View key={day.date} style={styles.weekDayCell} accessibilityLabel={`${weekdayLabel}, ${day.date}`}>
                  <Text style={[styles.weekdayLabel, { color: theme.colors.textWeak }]}>{weekdayLabel}</Text>
                  <View
                    style={[
                      styles.weekDot,
                      { backgroundColor: day.studied ? theme.colors.accent : theme.colors.border },
                    ]}
                  />
                </View>
              );
            })}

          </View>

        </Card>

        </FadeInUp>

      ) : null}

      </FadeInUp>

    </ScrollView>

  );

}



function lessonTitleFromModules(moduleList: readonly ModuleListEntry[], lessonId: string): string | null {
  for (const mod of moduleList) {
    for (const sub of mod.subModules) {
      for (const lesson of sub.lessons) {
        if (lesson.id === lessonId) return lesson.title;
      }
    }
  }
  return null;
}

function buildFallbackStartData(
  moduleList: readonly ModuleListEntry[],
  orderedLessonIds: readonly string[],
): StartData {
  const nextLessonId = getFirstPublishedLessonId(moduleList) ?? orderedLessonIds[0] ?? null;
  const week: StartData['week'] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    week.push({ date: d.toISOString().slice(0, 10), studied: false });
  }
  return {
    continueCard: null,
    nextLessonId,
    nextLessonTitle: nextLessonId ? lessonTitleFromModules(moduleList, nextLessonId) : null,
    dueReviewCount: 0,
    dailyLearningSecondsToday: null,
    week,
  };
}

function greetingForHour(hour: number): string {

  if (hour < 12) return de.start.greetingMorning;

  if (hour < 18) return de.start.greetingAfternoon;

  return de.start.greetingEvening;

}



function Card({
  theme,
  title,
  children,
  emphasized,
}: {
  theme: ReturnType<typeof useTheme>;
  title: string;
  children: ReactNode;
  emphasized?: boolean;
}) {

  return (

    <View

      style={[

        styles.card,

        {
          backgroundColor: theme.colors.surface,
          borderColor: emphasized ? theme.colors.accent : theme.colors.border,
          borderWidth: emphasized ? 2 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.base,
          marginTop: theme.spacing.base,
        },

      ]}

    >

      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>

      {children}

    </View>

  );

}



function SecondaryButton({ theme, label, onPress }: { theme: ReturnType<typeof useTheme>; label: string; onPress: () => void }) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.secondaryButton,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          marginTop: theme.spacing.md,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>{label}</Text>
    </PressableFeedback>
  );
}

function PrimaryButton({ theme, label, onPress }: { theme: ReturnType<typeof useTheme>; label: string; onPress: () => void }) {

  return (

    <PressableFeedback

      accessibilityRole="button"

      accessibilityLabel={label}

      onPress={onPress}

      style={[

        styles.primaryButton,

        {

          backgroundColor: theme.colors.accent,

          borderRadius: theme.radius.md,

          marginTop: theme.spacing.md,

          minHeight: theme.minTapTarget,

        },

      ]}

    >

      <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{label}</Text>

    </PressableFeedback>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1 },

  greeting: { fontWeight: '700' },

  card: {},

  cardTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  dailyGoalTrack: { height: 8, width: '100%', overflow: 'hidden' },

  dailyGoalFill: { height: 8 },

  cardHeadline: { fontSize: 17, lineHeight: 24, fontWeight: '600', marginTop: 4 },

  body: { fontSize: 15, lineHeight: 22, marginTop: 4 },

  primaryButton: { justifyContent: 'center', alignItems: 'center' },

  primaryButtonLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },

  secondaryButton: { justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },

  secondaryButtonLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },

  weekDayCell: { alignItems: 'center', gap: 4, minWidth: 28 },
  weekdayLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  weekDot: { width: 16, height: 16, borderRadius: 8 },

  cardActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },

  cardActionLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },

});


