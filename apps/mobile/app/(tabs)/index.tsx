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

// Reiter Start (AP-3.5, Punkt 5): Begrüßung nach Tageszeit ohne Namen,
// Fortsetzen-Karte, nächste Empfehlung, Tagesration-Kachel, Wochenübersicht.
// Das Hinweisbanner "neue Lektionen" hängt an Agent B's ContentProvider, der
// zum Zeitpunkt dieses Auftrags noch nicht existiert, und entfällt deshalb
// hier (kein Platzhalter für eine Datenquelle, die es noch nicht gibt).
export default function StartScreen() {
  const theme = useTheme();
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
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
          onAction={() => router.push('/lesson/M01-01-01')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: bottomInset }}
    >
      <Text style={[styles.greeting, { color: theme.colors.text }]}>{greeting}</Text>

      {data?.continueCard ? (
        <Card theme={theme} title={de.start.continueTitle}>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>
            {data.continueCard.state === 'listened' && data.continueCard.positionLabel
              ? de.start.continueListenFrom(data.continueCard.positionLabel)
              : data.continueCard.positionLabel
                ? de.start.continueReadFrom(data.continueCard.positionLabel)
                : data.continueCard.lessonId}
          </Text>
          <PrimaryButton
            theme={theme}
            label={de.start.continueOpen}
            onPress={() => {
              const lessonId = data.continueCard?.lessonId;
              if (lessonId) router.push(`/lesson/${lessonId}`);
            }}
          />
        </Card>
      ) : null}

      {data?.nextLessonId ? (
        <Card theme={theme} title={de.start.nextRecommendationTitle}>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>{data.nextLessonId}</Text>
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
      style={[
        styles.primaryButton,
        { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, marginTop: theme.spacing.sm, minHeight: theme.minTapTarget },
      ]}
    >
      <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  greeting: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  primaryButton: { justifyContent: 'center', alignItems: 'center' },
  primaryButtonLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  weekDot: { width: 16, height: 16, borderRadius: 8 },
});
