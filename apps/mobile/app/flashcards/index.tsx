import { useCallback, useMemo, useState } from 'react';
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

  const refresh = useCallback(() => {
    setLoading(true);
    loadFlashcardDeck(moduleFilter)
      .then((cards) => {
        setDeck(cards);
        setIndex(0);
        setFlipped(false);
      })
      .catch(() => setDeck([]))
      .finally(() => setLoading(false));
  }, [moduleFilter]);

  useFocusEffect(refresh);

  const card = deck[index];
  const progressLabel = useMemo(() => {
    if (deck.length === 0) return '';
    return de.flashcards.progress(index + 1, deck.length);
  }, [deck.length, index]);

  async function rate(wasCorrect: boolean) {
    if (!card) return;
    await saveFlashcardReview(card.id, wasCorrect);
    setFlipped(false);
    if (index + 1 < deck.length) {
      setIndex(index + 1);
    } else {
      setIndex(0);
    }
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
        {loading ? null : deck.length === 0 ? (
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
                  borderColor: theme.colors.border,
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
              <View style={[styles.actions, { gap: theme.spacing.sm, marginTop: theme.spacing.lg }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={de.flashcards.dontKnow}
                  onPress={() => void rate(false)}
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
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{de.flashcards.dontKnow}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={de.flashcards.know}
                  onPress={() => void rate(true)}
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
                  <Text style={[styles.actionLabel, { color: theme.colors.accentText }]}>{de.flashcards.know}</Text>
                </Pressable>
              </View>
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
});
