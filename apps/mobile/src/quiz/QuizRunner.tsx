import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import type { QuizAnswer, QuizQuestionInput, QuizResult } from '@futuredev/core';
import { useTheme } from '../theme/useTheme.js';
import { de } from '../i18n/de.js';
import { useReducedMotion } from '../accessibility/useReducedMotion.js';
import { resolveAnimationDuration } from '../accessibility/motion.js';
import { drawRound, evaluateRound, collectWrongAnswers, type QuizRound, type QuizScope } from './roundLogic.js';
import { shouldConfirmExit } from './exitGuard.js';
import { recordQuizRound } from './results.js';

interface QuizRunnerProps {
  pool: QuizQuestionInput[];
  desiredCount: number;
  scope: QuizScope;
  heading: string;
  onExit: () => void;
  onNextLesson?: () => void;
}

type Phase = 'rules' | 'question' | 'feedback' | 'result';

// Läuft für Lektionsquiz, Modulprüfung und Gesamtprüfung gleich ab (AP-3.5,
// Punkt 1): Regeln, eine Frage je Bildschirm mit vier Tastflächen, sofortige
// Rückmeldung mit Begründung, Fortschrittsbalken, Ergebnisbildschirm.
export function QuizRunner({ pool, desiredCount, scope, heading, onExit, onNextLesson }: QuizRunnerProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const reducedMotion = useReducedMotion();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const seedRef = useRef(Date.now());
  const [round, setRound] = useState<QuizRound>(() => drawRound(pool, desiredCount, seedRef.current));
  const [phase, setPhase] = useState<Phase>('rules');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saving, setSaving] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const question = round.drawn[index];
  const wrongAnswers = useMemo(
    () => (result ? collectWrongAnswers(round, answers) : []),
    [result, round, answers],
  );
  const progress = round.drawn.length > 0 ? (index + (phase === 'feedback' ? 1 : 0)) / round.drawn.length : 0;

  // Fortschrittsbalken-Wachstum animiert (design-system.md: 150 bis 250 ms
  // fuer alle Uebergaenge), aber nur, wenn Reduced Motion aus ist
  // (Pruefbericht Phase 3, B-06): eine reine CSS-Medienabfrage waere hier
  // wirkungslos, weil dies eine Animated-getriebene Bewegung ist.
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: resolveAnimationDuration(reducedMotion, 200),
      useNativeDriver: false,
    }).start();
  }, [progress, reducedMotion, progressAnim]);

  function startQuiz() {
    setPhase('question');
  }

  function chooseOption(optionIndex: number) {
    if (chosen !== null) return;
    setChosen(optionIndex);
    setPhase('feedback');
  }

  async function goNext() {
    if (chosen === null || !question) return;
    const nextAnswers = [...answers, { questionIndex: index, chosenOptionIndex: chosen }];
    setAnswers(nextAnswers);
    setChosen(null);

    if (index + 1 < round.drawn.length) {
      setIndex(index + 1);
      setPhase('question');
      return;
    }

    const finalResult = evaluateRound(round, nextAnswers);
    setResult(finalResult);
    setPhase('result');
    setSaving(true);
    try {
      await recordQuizRound({ scope, round, answers: nextAnswers, result: finalResult });
    } finally {
      setSaving(false);
    }
  }

  function requestCancel() {
    Alert.alert(de.quiz.cancelConfirmTitle, de.quiz.cancelConfirmBody, [
      { text: de.quiz.cancelConfirmNo, style: 'cancel' },
      { text: de.quiz.cancelConfirmYes, style: 'destructive', onPress: onExit },
    ]);
  }

  // Abbruch-Rueckfrage (Pruefbericht Phase 3, B-02): jeder Weg aus einer
  // laufenden Runde heraus, nicht nur der Abbrechen-Text oben rechts, muss
  // erst bestaetigt werden. `beforeRemove` deckt Navigation im Allgemeinen ab
  // (Zurueck-Geste, Kopfzeile, ein programmatischer Wechsel wie ein
  // Reiterwechsel, sofern die Pruefung je in einem Reiter statt in einer
  // eigenen Route liefe); `BackHandler` deckt zusaetzlich die physische
  // Zurueck-Taste auf Android ab, die manche Geraete nicht als
  // Navigationsereignis, sondern als eigenes Systemereignis melden.
  useEffect(() => {
    const beforeRemoveSub = navigation.addListener('beforeRemove', (e) => {
      if (!shouldConfirmExit(phaseRef.current)) return;
      e.preventDefault();
      Alert.alert(de.quiz.cancelConfirmTitle, de.quiz.cancelConfirmBody, [
        { text: de.quiz.cancelConfirmNo, style: 'cancel' },
        {
          text: de.quiz.cancelConfirmYes,
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });

    const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!shouldConfirmExit(phaseRef.current)) return false;
      requestCancel();
      return true;
    });

    return () => {
      beforeRemoveSub();
      backHandlerSub.remove();
    };
  }, [navigation]);

  function retryWithNewDraw() {
    seedRef.current = Date.now();
    setRound(drawRound(pool, desiredCount, seedRef.current));
    setIndex(0);
    setAnswers([]);
    setChosen(null);
    setResult(null);
    setPhase('rules');
  }

  if (phase === 'rules') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg, padding: theme.spacing.lg }]}>
        <Text style={[styles.heading, { color: theme.colors.text }]}>{heading}</Text>
        <Text style={[styles.title, { color: theme.colors.text, marginTop: theme.spacing.base }]}>
          {de.quiz.rulesTitle}
        </Text>
        <View style={{ marginTop: theme.spacing.base, gap: theme.spacing.sm }}>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>
            {de.quiz.rulesQuestionCount(round.drawn.length)}
          </Text>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.quiz.rulesPassThreshold}</Text>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.quiz.rulesNoPartialCredit}</Text>
          <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.quiz.rulesCancelWarning}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de.quiz.start}
          onPress={startQuiz}
          style={[
            styles.primaryButton,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing.xl,
              minHeight: theme.minTapTarget,
            },
          ]}
        >
          <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{de.quiz.start}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'result' && result) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.bg }}
        contentContainerStyle={[styles.resultContainer, { padding: theme.spacing.lg }]}
      >
        <Text
          style={[
            styles.resultTitle,
            { color: result.passed ? theme.colors.success : theme.colors.error },
          ]}
        >
          {result.passed ? de.quiz.resultTitlePassed : de.quiz.resultTitleFailed}
        </Text>
        <Text style={[styles.body, { color: theme.colors.text, marginTop: theme.spacing.xs }]}>
          {de.quiz.resultScore(result.correctCount, result.totalCount, result.scorePercent)}
        </Text>
        {saving ? null : null}
        {wrongAnswers.length > 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{de.quiz.resultWrongListTitle}</Text>
            {wrongAnswers.map((w) => (
              <View
                key={w.questionIndex}
                style={[
                  styles.wrongCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    marginTop: theme.spacing.sm,
                    padding: theme.spacing.base,
                  },
                ]}
              >
                <Text style={[styles.body, { color: theme.colors.text, fontWeight: '600' }]}>{w.question}</Text>
                <Text style={[styles.smallBody, { color: theme.colors.error, marginTop: theme.spacing.xs }]}>
                  {w.chosenExplanation}
                </Text>
                <Text style={[styles.smallBody, { color: theme.colors.success, marginTop: theme.spacing.xs }]}>
                  {de.quiz.correctAnswerLabel}: {w.correctText} — {w.correctExplanation}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          {onNextLesson ? <ResultButton label={de.quiz.nextLesson} onPress={onNextLesson} theme={theme} primary /> : null}
          <ResultButton label={de.quiz.toLesson} onPress={onExit} theme={theme} primary={!onNextLesson} />
          <ResultButton label={de.quiz.retryWithNewDraw} onPress={retryWithNewDraw} theme={theme} />
        </View>
      </ScrollView>
    );
  }

  if (!question) return null;

  const progressPercent = Math.round(progress * 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View
        style={[styles.progressTrack, { backgroundColor: theme.colors.border, borderRadius: theme.radius.full }]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.full,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <View style={styles.topRow}>
          <Text style={[styles.smallBody, { color: theme.colors.textWeak }]}>
            {de.quiz.questionOf(index + 1, round.drawn.length)} · {progressPercent}%
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={de.quiz.cancel} onPress={requestCancel}>
            <Text style={[styles.smallBody, { color: theme.colors.textWeak }]}>{de.quiz.cancel}</Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { color: theme.colors.text, marginTop: theme.spacing.base }]}>
          {question.question}
        </Text>
        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          {question.options.map((option, optionIndex) => {
            const isChosen = chosen === optionIndex;
            const showState = phase === 'feedback';
            let bg: string = theme.colors.surface;
            let border: string = theme.colors.border;
            if (showState && isChosen && option.isCorrect) {
              bg = theme.colors.success;
              border = theme.colors.success;
            } else if (showState && isChosen && !option.isCorrect) {
              bg = theme.colors.error;
              border = theme.colors.error;
            } else if (showState && option.isCorrect) {
              border = theme.colors.success;
            }
            return (
              <Pressable
                key={option.text}
                accessibilityRole="button"
                accessibilityLabel={option.text}
                accessibilityState={{ selected: isChosen }}
                onPress={() => chooseOption(optionIndex)}
                disabled={phase === 'feedback'}
                style={[
                  styles.option,
                  {
                    backgroundColor: bg,
                    borderColor: border,
                    borderRadius: theme.radius.md,
                    minHeight: 56,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    { color: showState && isChosen ? theme.colors.accentText : theme.colors.text },
                  ]}
                >
                  {option.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {phase === 'feedback' && chosen !== null ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <Text style={[styles.body, { color: theme.colors.text }]}>
              {question.options[chosen]?.explanation}
            </Text>
            {!question.options[chosen]?.isCorrect ? (
              <Text style={[styles.body, { color: theme.colors.success, marginTop: theme.spacing.xs }]}>
                {de.quiz.correctAnswerLabel}: {question.options.find((o) => o.isCorrect)?.explanation}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={de.quiz.next}
              onPress={goNext}
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
              <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{de.quiz.next}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ResultButton({
  label,
  onPress,
  theme,
  primary,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.primaryButton,
        {
          backgroundColor: primary ? theme.colors.accent : theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <Text style={[styles.primaryButtonLabel, { color: primary ? theme.colors.accentText : theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  resultContainer: { flexGrow: 1 },
  heading: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  smallBody: { fontSize: 13, lineHeight: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 8, width: '100%', overflow: 'hidden' },
  progressFill: { height: 8 },
  option: { borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  optionLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  primaryButton: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  primaryButtonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  resultTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  wrongCard: { borderWidth: StyleSheet.hairlineWidth },
});
