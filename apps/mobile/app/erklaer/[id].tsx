import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MessageCircleQuestion } from 'lucide-react-native';
import portfolioFile from '../../../../content/portfolio.json';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { generateStableQuestions } from '../../src/explain/generateStableQuestions.js';
import { markPortfolioExplained } from '../../src/explain/markExplained.js';

type SelfRating = 'know' | 'unsure' | 'unknown';
type StepPhase = 'rating' | 'sample' | 'done';

export default function ErklaerBausteinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const portfolioItem = portfolioFile.items.find((item) => item.id === id);

  const questions = useMemo(() => {
    if (!portfolioItem) return [];
    return generateStableQuestions({
      id: portfolioItem.id,
      title: portfolioItem.title,
      goal: portfolioItem.goal,
      proof: portfolioItem.proof,
    });
  }, [portfolioItem]);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<StepPhase>('rating');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const currentQuestion = questions[questionIndex];
  const progressLabel = de.erklaer.questionOf(questionIndex + 1, questions.length);

  function chooseRating(_rating: SelfRating) {
    if (phase !== 'rating') return;
    setPhase('sample');
  }

  function goNextQuestion() {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      setPhase('rating');
      return;
    }
    setPhase('done');
  }

  async function handlePass() {
    if (!portfolioItem || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const ok = await markPortfolioExplained(portfolioItem.id);
      if (!ok) {
        setSaveError(true);
        return;
      }
      router.replace('/(tabs)/ich');
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!portfolioItem) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState
          Icon={MessageCircleQuestion}
          title={de.erklaer.title}
          body={de.erklaer.missingBaustein}
          actionLabel={de.erklaer.back}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de.erklaer.back}
          onPress={() => router.back()}
          style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}
        >
          <Text style={[styles.backLabel, { color: theme.colors.accent }]}>{de.erklaer.back}</Text>
        </Pressable>
        <Text style={[styles.bausteinId, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>
          {portfolioItem.id}
        </Text>
        <Text style={[styles.bausteinTitle, { color: theme.colors.text, marginTop: theme.spacing.xs }]}>
          {portfolioItem.title}
        </Text>
      </View>

      {phase === 'done' ? (
        <View style={[styles.doneWrap, { padding: theme.spacing.lg }]}>
          <Text style={[styles.doneTitle, { color: theme.colors.text }]}>{de.erklaer.doneTitle}</Text>
          <Text style={[styles.doneBody, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>
            {de.erklaer.doneBody(portfolioItem.title)}
          </Text>
          {saveError ? (
            <Text style={[styles.errorText, { color: theme.colors.error, marginTop: theme.spacing.sm }]}>
              {de.erklaer.saveError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={de.erklaer.passButton}
            onPress={() => void handlePass()}
            disabled={saving}
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.md,
                marginTop: theme.spacing.lg,
                minHeight: theme.minTapTarget,
                opacity: saving ? 0.7 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.accentText} />
            ) : (
              <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>
                {de.erklaer.passButton}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
          <Text style={[styles.progress, { color: theme.colors.textWeak }]}>{progressLabel}</Text>
          <Text style={[styles.question, { color: theme.colors.text, marginTop: theme.spacing.base }]}>
            {currentQuestion?.question}
          </Text>

          {phase === 'rating' ? (
            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <RatingButton label={de.erklaer.ratingKnow} onPress={() => chooseRating('know')} theme={theme} />
              <RatingButton label={de.erklaer.ratingUnsure} onPress={() => chooseRating('unsure')} theme={theme} />
              <RatingButton label={de.erklaer.ratingUnknown} onPress={() => chooseRating('unknown')} theme={theme} />
            </View>
          ) : (
            <View
              style={[
                styles.sampleBox,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.base,
                  marginTop: theme.spacing.lg,
                },
              ]}
            >
              <Text style={[styles.sampleHeading, { color: theme.colors.text }]}>{de.erklaer.sampleTitle}</Text>
              <Text style={[styles.sampleBody, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>
                {currentQuestion?.sampleAnswer}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={de.erklaer.nextQuestion}
                onPress={goNextQuestion}
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
                  {questionIndex + 1 < questions.length ? de.erklaer.nextQuestion : de.erklaer.finishQuestions}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RatingButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.ratingButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
          paddingHorizontal: theme.spacing.base,
        },
      ]}
    >
      <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backLabel: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  bausteinId: { fontSize: 13, fontWeight: '600' },
  bausteinTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  progress: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  question: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  ratingButton: { borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  ratingLabel: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sampleBox: { borderWidth: StyleSheet.hairlineWidth },
  sampleHeading: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sampleBody: { fontSize: 15, lineHeight: 22 },
  primaryButton: { justifyContent: 'center', alignItems: 'center' },
  primaryButtonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  doneWrap: { flex: 1, justifyContent: 'center' },
  doneTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  doneBody: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
