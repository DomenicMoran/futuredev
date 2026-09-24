import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { de } from '../../src/i18n/de.js';
import { loadFlashcardDeck } from '../../src/flashcards/deck.js';
import type { FlashcardEntry } from '../../src/flashcards/types.js';
import { saveFlashcardReview } from '../../src/flashcards/reviews.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

export default function FlashcardsScreen() {
  const theme = useTheme();
  const bottomInset = useBottomChromeInset();
  const params = useLocalSearchParams<{ moduleId?: string }>();
  const moduleFilter = typeof params.moduleId === 'string' ? params.moduleId : undefined;
  const [deck, setDeck] = useState<FlashcardEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deckCompleted, setDeckCompleted] = useState(false);
  const [rateFeedback, setRateFeedback] = useState<'know' | 'dont' | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckRef = useRef<FlashcardEntry[]>([]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    loadFlashcardDeck(moduleFilter)
      .then((cards) => {
        setDeck(cards);
        setIndex(0);
        setFlipped(false);
        setDeckCompleted(false);
      })
      .catch(() => setDeck([]))
      .finally(() => setLoading(false));
  }, [moduleFilter]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return clearAdvanceTimer;
    }, [refresh, clearAdvanceTimer]),
  );

  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  const card = deck[index];
  const progressLabel = useMemo(() => {
    if (deck.length === 0) return '';
    return de.flashcards.progress(index + 1, deck.length);
  }, [deck.length, index]);

  async function rate(wasCorrect: boolean) {
    if (!card || rateFeedback !== null) return;
    clearAdvanceTimer();
    setRateFeedback(wasCorrect ? 'know' : 'dont');
    await saveFlashcardReview(card.id, wasCorrect);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setFlipped(false);
      setRateFeedback(null);
      setIndex((prev) => {
        const len = deckRef.current.length;
        if (prev + 1 < len) {
          return prev + 1;
        }
        setDeckCompleted(true);
        return prev;
      });
    }, 320);
  }

  function restartDeck() {
    setDeckCompleted(false);
    setIndex(0);
    setFlipped(false);
    setRateFeedback(null);
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.base }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={de.flashcards.back}
          hitSlop={12}
          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}
        >
          <ChevronLeft color={theme.colors.text} size={26} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{de.flashcards.title}</Text>
        <View style={{ width: theme.minTapTarget }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.base,
          paddingBottom: bottomInset,
          flexGrow: 1,
          justifyContent: deck.length ? 'flex-start' : 'center',
        }}
      >
        {loading ? (
          <Text style={[styles.empty, { color: theme.colors.textWeak }]}>{de.flashcards.loading}</Text>
        ) : deckCompleted ? (
          <View style={[styles.completion, { gap: theme.spacing.base }]}>
            <Text style={[styles.cardText, { color: theme.colors.text }]}>{de.flashcards.deckCompleteTitle}</Text>
            <View style={[styles.actions, { marginTop: theme.spacing.md }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={de.flashcards.deckCompleteAgain}
                onPress={restartDeck}
                style={[
                  styles.actionButton,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    minHeight: theme.minTapTarget,
                    flex: 1,
                  },
                ]}
              >
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{de.flashcards.deckCompleteAgain}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={de.flashcards.deckCompleteDone}
                onPress={() => router.back()}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.accent,
                    borderRadius: theme.radius.md,
                    minHeight: theme.minTapTarget,
                    flex: 1,
                  },
                ]}
              >
                <Text style={[styles.actionLabel, { color: theme.colors.accentText }]}>{de.flashcards.deckCompleteDone}</Text>
              </Pressable>
            </View>
          </View>
        ) : deck.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textWeak }]}>{de.flashcards.emptyBody}</Text>
        ) : card ? (
          <>
            <Text style={[styles.progress, { color: theme.colors.textWeak, marginBottom: theme.spacing.sm }]}>
              {progressLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={flipped ? de.flashcards.showTerm : de.flashcards.showDefinition}
              onPress={() => setFlipped((value) => !value)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor:
                    rateFeedback === 'know'
                      ? theme.colors.success
                      : rateFeedback === 'dont'
                        ? theme.colors.error
                        : theme.colors.border,
                  borderWidth: rateFeedback ? 2 : StyleSheet.hairlineWidth,
                  borderRadius: theme.radius.lg,
                  minHeight: 220,
                  padding: theme.spacing.lg,
                },
              ]}
            >
              <Text style={[styles.cardText, { color: theme.colors.text }]}>
                {flipped ? card.definition : card.term}
              </Text>
              <Text style={[styles.hint, { color: theme.colors.textWeak, marginTop: theme.spacing.base }]}>
                {flipped ? de.flashcards.tapForTerm : de.flashcards.tapForDefinition}
              </Text>
            </Pressable>

            {flipped ? (
              <>
                {rateFeedback ? (
                  <Text
                    style={[
                      styles.feedbackLine,
                      {
                        color: rateFeedback === 'know' ? theme.colors.success : theme.colors.error,
                        marginTop: theme.spacing.sm,
                      },
                    ]}
                  >
                    {rateFeedback === 'know' ? de.flashcards.feedbackKnow : de.flashcards.feedbackDontKnow}
                  </Text>
                ) : null}
                <View style={[styles.actions, { gap: theme.spacing.sm, marginTop: theme.spacing.lg }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={de.flashcards.dontKnow}
                    onPress={() => void rate(false)}
                    disabled={rateFeedback !== null}
                    style={[
                      styles.actionButton,
                      {
                        borderColor: rateFeedback === 'dont' ? theme.colors.error : theme.colors.border,
                        borderWidth: rateFeedback === 'dont' ? 2 : StyleSheet.hairlineWidth,
                        borderRadius: theme.radius.md,
                        minHeight: theme.minTapTarget,
                        flex: 1,
                        opacity: rateFeedback !== null && rateFeedback !== 'dont' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{de.flashcards.dontKnow}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={de.flashcards.know}
                    onPress={() => void rate(true)}
                    disabled={rateFeedback !== null}
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: theme.colors.accent,
                        borderColor: rateFeedback === 'know' ? theme.colors.success : theme.colors.accent,
                        borderWidth: rateFeedback === 'know' ? 2 : 0,
                        borderRadius: theme.radius.md,
                        minHeight: theme.minTapTarget,
                        flex: 1,
                        opacity: rateFeedback !== null && rateFeedback !== 'know' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionLabel, { color: theme.colors.accentText }]}>{de.flashcards.know}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  progress: { fontSize: 14, textAlign: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  cardText: { fontSize: 22, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  actions: { flexDirection: 'row' },
  actionButton: { justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  actionLabel: { fontSize: 16, fontWeight: '600' },
  empty: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  feedbackLine: { fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  completion: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
});
