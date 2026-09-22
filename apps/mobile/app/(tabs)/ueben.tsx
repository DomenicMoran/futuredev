import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Dumbbell, Headphones, MessageCircleQuestion } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { loadReviewCards } from '../../src/review/cards.js';
import { dailyRationSize, selectDailyRation } from '../../src/review/dailyRation.js';
import { pickReviewLesson } from '../../src/review/reviewRound.js';
import { knownLessonIds } from '../../src/quiz/content.js';

// Reiter Üben (AP-3.5, Punkt 2): Tagesration aus @futuredev/core (leitner.ts),
// Modul-/Gesamtprüfung, Wiederholungsclips (öffnet vorerst den Hören-Reiter,
// da Agent C's player.enqueueLessons zum Zeitpunkt dieses Auftrags noch nicht
// existiert, siehe app/(tabs)/hoeren.tsx).
export default function UebenScreen() {
  const theme = useTheme();
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const reviewIntensity = useSettingsStore((s) => s.reviewIntensity);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [reviewLessonId, setReviewLessonId] = useState<string | null>(null);
  const [availableModuleIds, setAvailableModuleIds] = useState<string[]>([]);

  const refresh = useCallback(() => {
    let cancelled = false;
    loadReviewCards()
      .then((cards) => {
        if (cancelled) return;
        const size = dailyRationSize(dailyGoalMinutes, reviewIntensity);
        const ration = selectDailyRation(cards, size);
        setDueCount(ration.length);
        setReviewLessonId(pickReviewLesson(ration));
      })
      .catch(() => {
        if (!cancelled) {
          setDueCount(0);
          setReviewLessonId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dailyGoalMinutes, reviewIntensity]);

  useFocusEffect(refresh);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      knownLessonIds()
        .then((ids) => {
          if (!cancelled) setAvailableModuleIds([...new Set(ids.map((id) => id.slice(0, 3)))]);
        })
        .catch(() => {
          if (!cancelled) setAvailableModuleIds([]);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={{ padding: theme.spacing.lg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
    >
      {dueCount === null ? null : dueCount === 0 ? (
        <EmptyState
          Icon={Dumbbell}
          title={de.ueben.emptyTitle}
          body={de.ueben.emptyBody}
          actionLabel={de.ueben.emptyAction}
          onAction={() => router.push('/(tabs)/lernen')}
        />
      ) : (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.spacing.base },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{de.ueben.dailyRationTitle}</Text>
          <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
            {de.ueben.dailyRationBody(dueCount)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={de.ueben.startDailyRation}
            onPress={() => reviewLessonId && router.push(`/quiz/${reviewLessonId}`)}
            disabled={!reviewLessonId}
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.md,
                marginTop: theme.spacing.base,
                minHeight: theme.minTapTarget,
              },
            ]}
          >
            <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>
              {de.ueben.startDailyRation}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.row, { marginTop: theme.spacing.lg, gap: theme.spacing.sm }]}>
        {availableModuleIds.map((moduleId) => (
          <Tile
            key={moduleId}
            label={`${de.ueben.moduleExamTile} ${moduleId}`}
            onPress={() => router.push(`/quiz/exam?scope=module:${moduleId}`)}
            theme={theme}
          />
        ))}
        <Tile label={de.ueben.allExamTile} onPress={() => router.push('/quiz/exam?scope=all')} theme={theme} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.ueben.explainExamAction}
        onPress={() => router.push('/erklaer')}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.base,
            marginTop: theme.spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          },
        ]}
      >
        <MessageCircleQuestion color={theme.colors.accent} size={28} strokeWidth={1.75} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{de.ueben.explainExamTitle}</Text>
          <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
            {de.ueben.explainExamBody}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.ueben.reviewClipsAction}
        onPress={() => router.push('/(tabs)/hoeren')}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.base,
            marginTop: theme.spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Headphones color={theme.colors.accent} size={28} strokeWidth={1.75} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{de.ueben.reviewClipsTitle}</Text>
          <Text style={[styles.cardBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
            {de.ueben.reviewClipsBody}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

function Tile({ label, onPress, theme }: { label: string; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
          paddingHorizontal: theme.spacing.base,
        },
      ]}
    >
      <Text style={[styles.tileLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  primaryButton: { justifyContent: 'center', alignItems: 'center' },
  primaryButtonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  tileLabel: { fontSize: 14, fontWeight: '500' },
});
