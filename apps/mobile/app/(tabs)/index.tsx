import { useCallback, useState, type ReactNode } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import { Sparkles } from 'lucide-react-native';

import { useTheme } from '../../src/theme/useTheme.js';

import { EmptyState } from '../../src/components/EmptyState.js';

import { de } from '../../src/i18n/de.js';

import { useSettingsStore } from '../../src/state/settings.js';

import { loadStartData, type StartData } from '../../src/settings/startData.js';

import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

import { useContent } from '../../src/content/ContentProvider.js';

import { openFirstPublishedLessonOrLernen } from '../../src/navigation/openFirstLesson.js';

import {

  continueActionLabel,

  openContinueDestination,

  resolveContinueMode,

} from '../../src/settings/continueNavigation.js';



export default function StartScreen() {

  const theme = useTheme();

  const { moduleList } = useContent();

  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);

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

        <EmptyState

          Icon={Sparkles}

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

        paddingTop: theme.spacing.lg,

        paddingBottom: bottomInset,

      }}

    >

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



      {data ? (

        <Card theme={theme} title={de.start.dailyGoalTitle}>

          <Text style={[styles.body, { color: theme.colors.textWeak }]}>

            {data.dueReviewCount > 0

              ? de.start.dailyGoalDueReviews(data.dueReviewCount)

              : de.start.dailyRationTileEmpty}

          </Text>

          <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>

            {de.start.dailyGoalSettingsTip(dailyGoalMinutes)}

          </Text>

        </Card>

      ) : null}



      {continueCard && continueMode ? (

        <Pressable

          accessibilityRole="button"

          accessibilityLabel={`${continueActionLabel(continueMode)}: ${continueCard.lessonTitle}`}

          onPress={openContinue}

          style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}

        >

          <Card theme={theme} title={de.start.continueTitle}>

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



      {data?.nextLessonId ? (

        <Card theme={theme} title={de.start.nextRecommendationTitle}>

          <Text style={[styles.cardHeadline, { color: theme.colors.text }]} numberOfLines={2}>

            {data.nextLessonTitle ?? de.start.nextRecommendationFallback}

          </Text>

          <PrimaryButton

            theme={theme}

            label={de.start.nextRecommendationAction}

            onPress={() => router.push(`/lesson/${data.nextLessonId}`)}

          />

        </Card>

      ) : null}



      <Pressable onPress={() => router.push('/(tabs)/ueben')}>

        <Card theme={theme} title={de.start.dailyRationTile}>

          <Text style={[styles.body, { color: theme.colors.textWeak }]}>

            {data && data.dueReviewCount > 0 ? de.start.dailyRationTileBody(data.dueReviewCount) : de.start.dailyRationTileEmpty}

          </Text>

        </Card>

      </Pressable>



      {data ? (

        <Card theme={theme} title={de.start.weekOverviewTitle}>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>

            {data.week.map((day) => (

              <View

                key={day.date}

                accessibilityLabel={day.date}

                style={[

                  styles.weekDot,

                  { backgroundColor: day.studied ? theme.colors.accent : theme.colors.border },

                ]}

              />

            ))}

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



function Card({ theme, title, children }: { theme: ReturnType<typeof useTheme>; title: string; children: ReactNode }) {

  return (

    <View

      style={[

        styles.card,

        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.spacing.base, marginTop: theme.spacing.base },

      ]}

    >

      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>

      {children}

    </View>

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

  card: { borderWidth: StyleSheet.hairlineWidth },

  cardTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  cardHeadline: { fontSize: 17, lineHeight: 24, fontWeight: '600', marginTop: 4 },

  body: { fontSize: 15, lineHeight: 22, marginTop: 4 },

  primaryButton: { justifyContent: 'center', alignItems: 'center' },

  primaryButtonLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },

  weekDot: { width: 16, height: 16, borderRadius: 8 },

});


