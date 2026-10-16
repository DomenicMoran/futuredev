import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme.js';
import { de } from '../src/i18n/de.js';
import { loadFlashcardDeck } from '../src/flashcards/deck.js';
import { getContentFs, loadLesson } from '../src/content/index.js';
import { getSetting } from '../src/data/settings.js';
import { onlyStoredConfusion, recallCovers } from '../src/learn/session.js';

const INTACT = 'const summe = links + rechts';
const BROKEN = 'const summe = links - rechts';

export default function BauenScreen() {
  const theme = useTheme();
  const [task, setTask] = useState('');
  const [expectation, setExpectation] = useState('');
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [guess, setGuess] = useState('');
  const [compared, setCompared] = useState(false);
  const [hit, setHit] = useState(false);
  const [broken, setBroken] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [deck, confusionId] = await Promise.all([loadFlashcardDeck(), getSetting('learn_next_confusion')]);
        const card = onlyStoredConfusion(deck, confusionId?.trim() ? confusionId : null)[0];
        if (!card) return;
        const lesson = await loadLesson(await getContentFs(), card.lessonId);
        if (!active || !lesson) return;
        setTask(lesson.practiceTask.task);
        setExpectation(lesson.practiceTask.expectation);
        setPortfolioId(lesson.practiceTask.portfolioItem ?? null);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>{de.ueben.bauenTitle}</Text>
        <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ueben.bauenBody}</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{de.learn.loadError}</Text> : null}
        {task ? <Text style={[styles.body, { color: theme.colors.text }]}>{task}</Text> : null}
        <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.buildTitle}</Text>
        <TextInput
          value={guess}
          onChangeText={setGuess}
          accessibilityLabel={de.learn.buildTitle}
          multiline
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setHit(recallCovers(guess, expectation, expectation));
            setCompared(true);
          }}
          style={styles.button}
        >
          <Text style={{ color: theme.colors.text }}>{de.learn.check}</Text>
        </Pressable>
        {compared ? (
          <Text style={[styles.body, { color: theme.colors.text }]}>{hit ? de.learn.hit : de.learn.miss} {de.learn.buildExpect} {expectation}</Text>
        ) : null}
        <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.buildBroken}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={INTACT} onPress={() => setBroken(false)} style={[styles.choice, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>{INTACT}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={BROKEN} onPress={() => setBroken(true)} style={[styles.choice, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>{BROKEN}</Text>
        </Pressable>
        {broken !== null ? (
          <Text style={[styles.body, { color: theme.colors.text }]}>{broken ? de.learn.correct : de.learn.incorrect}</Text>
        ) : null}
        {portfolioId ? <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.learn.buildPortfolio(portfolioId)}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/ich')} style={styles.button}>
          <Text style={{ color: theme.colors.text }}>{de.learn.buildPortfolio(portfolioId ?? 'P00')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  prompt: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  button: { minHeight: 48, justifyContent: 'center' },
  choice: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 16 },
});
