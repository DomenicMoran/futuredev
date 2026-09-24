import { useCallback, useState, type ReactNode } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import { BookOpen, ChevronRight } from 'lucide-react-native';

import { useTheme } from '../../src/theme/useTheme.js';

import { EmptyState } from '../../src/components/EmptyState.js';

import { de } from '../../src/i18n/de.js';

import { useSettingsStore } from '../../src/state/settings.js';

import { loadStartData, type StartData } from '../../src/settings/startData.js';

import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

import { useContent } from '../../src/content/ContentProvider.js';

import { openFirstPublishedLessonOrLernen } from '../../src/navigation/openFirstLesson.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';

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

  const bottomInset = useBottomChromeInset();



  const refresh = useCallback(() => {

    loadStartData(dailyGoalMinutes, reviewIntensity)

      .then(setData)

      .catch(() => setData(null));

  }, [dailyGoalMinutes, reviewIntensity]);



  useFocusEffect(refresh);



  const greeting = greetingForHour(new Date().getHours());

  const hasAnything = data && (data.continueCard || data.nextLessonId);



  if (!hasAnything) {

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



  const continueCard = data?.continueCard ?? null;
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

        <Pressable

          accessibilityRole="button"

          accessibilityLabel={`${continueActionLabel(continueMode)}: ${continueCard.lessonTitle}`}

          onPress={openContinue}

          style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}

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

        </Pressable>

      ) : null}



      {data ? (

        <Card theme={theme} title={de.start.dailyGoalTitle}>

          {(() => {
            const seconds =
              data.dailyLearningSecondsToday ?? dailyLearningSecondsToday ?? null;
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

            {data.dueReviewCount > 0

              ? de.start.dailyGoalDueReviews(data.dueReviewCount)

              : de.start.dailyRationTileEmpty}

          </Text>

        </Card>

      ) : null}



      {data?.nextLessonId ? (

        <Card theme={theme} title={de.start.nextRecommendationTitle}>

          <Text style={[styles.cardHeadline, { color: theme.colors.text }]} numberOfLines={2}>

            {data.nextLessonTitle ?? de.start.nextRecommendationFallback}

          </Text>

          <SecondaryButton

            theme={theme}

            label={de.start.nextRecommendationAction}

            onPress={() => router.push(`/lesson/${data.nextLessonId}`)}

          />

        </Card>

      ) : null}



      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.start.dailyRationOpen}
        onPress={() => router.push('/(tabs)/ueben')}
        style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}
      >

        <Card theme={theme} title={de.start.dailyRationTile}>

          <Text style={[styles.body, { color: theme.colors.textWeak }]}>

            {data && data.dueReviewCount > 0 ? de.start.dailyRationTileBody(data.dueReviewCount) : de.start.dailyRationTileEmpty}

          </Text>

          <View style={styles.cardActionRow}>
            <Text style={[styles.cardActionLabel, { color: theme.colors.accent }]}>{de.start.dailyRationOpen}</Text>
            <ChevronRight color={theme.colors.accent} size={20} strokeWidth={1.75} />
          </View>

        </Card>

      </Pressable>



      {data ? (

        <Card theme={theme} title={de.start.weekOverviewTitle}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>

            {data.week.map((day) => {
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

      ) : null}

    </ScrollView>

  );

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          marginTop: theme.spacing.md,
          minHeight: theme.minTapTarget,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ theme, label, onPress }: { theme: ReturnType<typeof useTheme>; label: string; onPress: () => void }) {

  return (

    <Pressable

      accessibilityRole="button"

      accessibilityLabel={label}

      onPress={onPress}

      style={({ pressed }) => [

        styles.primaryButton,

        {

          backgroundColor: theme.colors.accent,

          borderRadius: theme.radius.md,

          marginTop: theme.spacing.md,

          minHeight: theme.minTapTarget,

          opacity: pressed ? 0.92 : 1,

        },

      ]}

    >

      <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{label}</Text>

    </Pressable>

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


