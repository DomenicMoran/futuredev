import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { QuizQuestionInput } from '@futuredev/core';
import { Layers } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { loadAllQuiz } from '../../src/quiz/content.js';
import { QuizRunner } from '../../src/quiz/QuizRunner.js';
import type { QuizScope } from '../../src/quiz/roundLogic.js';
import { selectReviewQuestionsForCards } from '../../src/review/reviewRound.js';

/** A review round contains only the exact due cards chosen on the practice screen. */
export default function ReviewQuizScreen() {
  const { cardIds: rawCardIds } = useLocalSearchParams<{ cardIds?: string }>();
  const theme = useTheme();
  const cardIds = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(rawCardIds ?? '[]');
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
    } catch { return []; }
  }, [rawCardIds]);
  const [pool, setPool] = useState<QuizQuestionInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = useMemo<QuizScope>(() => ({ type: 'review', cardIds }), [cardIds]);

  useEffect(() => {
    let cancelled = false;
    setPool(null);
    setError(null);
    if (!cardIds.length) {
      setError('Es sind keine fälligen Wiederholungsfragen ausgewählt.');
      return () => { cancelled = true; };
    }
    loadAllQuiz().then((allQuestions) => {
      if (cancelled) return;
      const selection = selectReviewQuestionsForCards(allQuestions, cardIds);
      if (selection.missingCardIds.length > 0) {
        setError('Einige ausgewählte Fragen sind nicht mehr verfügbar. Bitte lade die Wiederholungen neu.');
        return;
      }
      setPool(selection.questions);
    }).catch((err: unknown) => {
      if (!cancelled) setError(String(err instanceof Error ? err.message : err));
    });
    return () => { cancelled = true; };
  }, [cardIds]);

  if (error || !pool) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={Layers} title="Wiederholen" body={error ?? 'Wiederholungsfragen werden geladen.'} />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <QuizRunner
        key={cardIds.join('|')}
        pool={pool}
        desiredCount={pool.length}
        scope={scope}
        heading={de.ueben.sectionWiederholen}
        onExit={() => router.replace('/(tabs)/ueben')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
