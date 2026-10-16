import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme.js';
import { de } from '../src/i18n/de.js';
import { loadFlashcardDeck } from '../src/flashcards/deck.js';
import type { FlashcardEntry } from '../src/flashcards/types.js';
import { getContentFs, loadLesson } from '../src/content/index.js';
import { getSetting, setSetting } from '../src/data/settings.js';
import { playLesson } from '../src/player/index.js';
import {
  classifyMiss,
  clozeOwnSentence,
  firstHint,
  interleaveModules,
  keySentences,
  mayStop,
  nextStep,
  onlyStoredConfusion,
  openingBlocks,
  quietClose,
  recallCovers,
  textOutsideSpeech,
  type Door,
  type Energy,
  type ErrorKind,
  type Focus,
} from '../src/learn/session.js';
import {
  buildPacket,
  buildSequence,
  buildSpot,
  columnsAreCorrect,
  exampleClause,
  sequenceIsCorrect,
  shuffle,
  TCP_UDP,
  type TermCard,
} from '../src/learn/games.js';

const CONFUSION_KEY = 'learn_next_confusion';

export default function SitzungScreen() {
  const theme = useTheme();
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [door, setDoor] = useState<Door | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [opening, setOpening] = useState<string[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [clozeAnswer, setClozeAnswer] = useState('');
  const [clozeDone, setClozeDone] = useState(false);
  const [cards, setCards] = useState<FlashcardEntry[]>([]);
  const [pool, setPool] = useState<FlashcardEntry[]>([]);
  const [hasConfusion, setHasConfusion] = useState(false);
  const [answer, setAnswer] = useState('');
  const [recallHit, setRecallHit] = useState(false);
  const [itemsDone, setItemsDone] = useState(0);
  const [unsureStreak, setUnsureStreak] = useState(0);
  const [kind, setKind] = useState<ErrorKind | null>(null);
  const [keysDone, setKeysDone] = useState(false);
  const [sawOptions, setSawOptions] = useState(false);
  const [sawPractice, setSawPractice] = useState(false);
  const [sawExample, setSawExample] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [second, setSecond] = useState<string | null>(null);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const checking = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [deck, confusionId] = await Promise.all([loadFlashcardDeck(), getSetting(CONFUSION_KEY)]);
        if (!active) return;
        const stored = confusionId?.trim() ? confusionId : null;
        setHasConfusion(Boolean(stored));
        setPool(deck);
        const one = onlyStoredConfusion(deck, stored);
        setCards(stored ? one : interleaveModules(one.slice(0, 1), one.slice(1)));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const card = cards[cardIndex] ?? cards[0];
  const step = energy
    ? nextStep({
      energy,
      unsureStreak,
      itemsDone,
      hasConfusion,
      recallHit,
      sawOptions,
      sawPractice,
      sawExample,
      keysDone,
      errorKind: kind,
      focus: focus ?? undefined,
    })
    : null;

  async function loadLessonContext(entry: FlashcardEntry, chosenDoor: Door | null = door) {
    const fs = await getContentFs();
    const lesson = await loadLesson(fs, entry.lessonId);
    const speech = lesson?.speechBlocks.map((block) => block.text) ?? [];
    setKeys(keySentences(lesson?.speechBlocks ?? []));
    setLessonTitle(lesson?.title ?? '');
    setPortfolioId(lesson?.practiceTask.portfolioItem ?? null);
    const practice = lesson?.practiceExample.text ?? '';
    setSecond(textOutsideSpeech(practice, speech) ?? textOutsideSpeech(exampleClause(entry.definition) ?? '', speech));
    if (chosenDoor) setOpening(openingBlocks(lesson?.speechBlocks ?? [], chosenDoor));
  }

  async function checkRecall() {
    if (!card || checking.current || itemsDone > 0) return;
    checking.current = true;
    const blank = answer.trim().length === 0;
    const covered = recallCovers(answer, card.term, card.definition);
    setRecallHit(covered);
    setItemsDone(1);
    if (covered) {
      setUnsureStreak(0);
      setKind(null);
      await setSetting(CONFUSION_KEY, '');
      return;
    }
    setUnsureStreak(1);
    setKind(classifyMiss({ question: card.term, chosen: answer, correct: card.definition, answerBlank: blank }));
    await setSetting(CONFUSION_KEY, card.id);
  }

  function pickOption(id: string) {
    if (!card || sawOptions) return;
    setSawOptions(true);
    if (id !== card.id) {
      setUnsureStreak((count) => count + 1);
      setKind((current) => current ?? 'verwechselt');
      void setSetting(CONFUSION_KEY, card.id);
    }
  }

  const options = card
    ? shuffle([card, ...shuffle(pool.filter((entry) => entry.id !== card.id), 3).slice(0, 3)], 5)
    : [];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>{de.ueben.sitzungTitle}</Text>
        <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ueben.sitzungBody}</Text>
        {loading ? <Text style={{ color: theme.colors.textWeak }}>{de.quiz.loadingBody}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{de.learn.loadError}</Text> : null}
        {!loading && cards.length === 0 && !error ? <Text style={{ color: theme.colors.text }}>{de.learn.empty}</Text> : null}
        {door === null && card ? (
          <View>
            <Choice label={de.learn.doorImage} hint={de.learn.doorImageHint} onPress={() => { setDoor('bild'); void loadLessonContext(card, 'bild'); }} />
            <Choice label={de.learn.doorExample} hint={de.learn.doorExampleHint} onPress={() => { setDoor('beispiel'); void loadLessonContext(card, 'beispiel'); }} />
            <Choice label={de.learn.doorTerm} hint={de.learn.doorTermHint} onPress={() => { setDoor('begriff'); void loadLessonContext(card, 'begriff'); }} />
          </View>
        ) : null}
        {door && energy === null && card ? (
          <View>
            {opening.map((line, index) => (
              <Text key={`${index}-${line}`} style={[styles.body, { color: theme.colors.text }]}>{line}</Text>
            ))}
            <Choice label={de.learn.calm} hint={de.learn.calmHint} onPress={() => setEnergy('ruhig')} />
            <Choice label={de.learn.awake} hint={de.learn.awakeHint} onPress={() => setEnergy('wach')} />
          </View>
        ) : null}
        {energy && focus === null ? (
          <View>
            <Choice label={de.learn.focusTerm} hint={de.learn.focusTermHint} onPress={() => setFocus('begriff')} />
            <Choice label={de.learn.focusFlow} hint={de.learn.focusFlowHint} onPress={() => setFocus('ablauf')} />
            <Choice label={de.learn.focusFault} hint={de.learn.focusFaultHint} onPress={() => setFocus('fehler')} />
          </View>
        ) : null}
        {focus && (step?.type === 'pause' || step?.type === 'stop') ? (
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>{step.type === 'pause' ? de.learn.pauseTitle : de.learn.stopTitle}</Text>
            <Text style={[styles.body, { color: theme.colors.textWeak }]}>{step.type === 'pause' ? de.learn.pauseBody : quietClose({ held: recallHit, tomorrow: kind ? card?.term ?? null : null })}</Text>
          </View>
        ) : null}
        {focus && recallHit && !clozeDone && clozeOwnSentence(answer) ? (
          <View style={styles.block}>
            <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.clozeTitle}</Text>
            <Text style={[styles.body, { color: theme.colors.text }]}>{clozeOwnSentence(answer)?.prompt}</Text>
            <TextInput value={clozeAnswer} onChangeText={setClozeAnswer} accessibilityLabel={de.learn.clozeTitle} style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} />
            <Pressable accessibilityRole="button" onPress={() => { if (clozeAnswer.trim().toLocaleLowerCase('de') === (clozeOwnSentence(answer)?.missing ?? '').toLocaleLowerCase('de')) setClozeDone(true); }} style={styles.button}>
              <Text style={{ color: theme.colors.text }}>{de.learn.check}</Text>
            </Pressable>
          </View>
        ) : null}
        {focus && step?.type === 'key-sentences' ? (
          <View style={styles.block}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{de.learn.keysTitle}</Text>
            {keys.map((sentence, index) => (
              <Text key={`${index}-${sentence}`} style={[styles.body, { color: theme.colors.text }]}>{sentence}</Text>
            ))}
            {card ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => { void playLesson(card.lessonId).then(() => router.push({ pathname: '/player', params: { keys: '1' } })); }}
                style={styles.button}
              >
                <Text style={{ color: theme.colors.text }}>{de.learn.keysListen}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setKeysDone(true)} style={styles.button}>
              <Text style={{ color: theme.colors.text }}>{de.learn.next}</Text>
            </Pressable>
          </View>
        ) : null}
        {focus && (step?.type === 'recall' || step?.type === 'one-card') && card ? (
          <View style={styles.block}>
            <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.prompt(card.term)}</Text>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              accessibilityLabel={de.learn.answerLabel}
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              multiline
            />
            <Pressable accessibilityRole="button" onPress={() => void checkRecall()} style={styles.button}>
              <Text style={{ color: theme.colors.text }}>{de.learn.check}</Text>
            </Pressable>
          </View>
        ) : null}
        {focus && step?.type === 'options' && card ? (
          <View style={styles.block}>
            <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.optionsPrompt}</Text>
            {kind ? <Text style={[styles.body, { color: theme.colors.text }]}>{de.learn.kind[kind]} {firstHint(card.definition)}</Text> : null}
            {options.map((entry) => (
              <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={entry.term} onPress={() => pickOption(entry.id)} style={[styles.choice, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>{entry.term}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {focus && step?.type === 'practice' && card ? (
          <Practice
            drill={step.drill}
            card={card}
            pool={pool}
            onDone={(hit) => {
              setSawPractice(true);
              if (!hit) {
                setUnsureStreak((count) => count + 1);
                void setSetting(CONFUSION_KEY, card.id);
              }
            }}
          />
        ) : null}
        {focus && step?.type === 'second-example' ? (
          <View style={styles.block}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{de.learn.secondTitle}</Text>
            <Text style={[styles.body, { color: theme.colors.text }]}>{second ?? de.learn.secondMissing}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSawExample(true)} style={styles.button}>
              <Text style={{ color: theme.colors.text }}>{de.learn.next}</Text>
            </Pressable>
            {portfolioId ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/bauen')} style={styles.button}>
                <Text style={{ color: theme.colors.text }}>{de.learn.buildFromLesson(lessonTitle || portfolioId)}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {focus && step?.type === 'stop' && cardIndex + 1 < cards.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              checking.current = false;
              setCardIndex((current) => current + 1);
              setItemsDone(0);
              setRecallHit(false);
              setSawOptions(false);
              setSawPractice(false);
              setSawExample(false);
              setKeysDone(false);
              setAnswer('');
              setClozeDone(false);
              setKind(null);
            }}
            style={styles.button}
          >
            <Text style={{ color: theme.colors.text }}>{de.learn.olderCard}</Text>
          </Pressable>
        ) : null}
        {focus && (mayStop(itemsDone) || keysDone || step?.type === 'stop' || step?.type === 'pause') ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
            <Text style={{ color: theme.colors.text }}>{de.learn.enough}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Practice({
  drill,
  card,
  pool,
  onDone,
}: {
  drill: 'contrast' | 'sequence' | 'spot' | 'example';
  card: FlashcardEntry;
  pool: readonly FlashcardEntry[];
  onDone: (hit: boolean) => void;
}) {
  const theme = useTheme();
  const lessonTerms: TermCard[] = pool.filter((entry) => entry.lessonId === card.lessonId);
  const sequence = buildSequence(lessonTerms.length >= 3 ? lessonTerms : pool, 2);
  const spot = buildSpot(card.definition, pool.find((entry) => entry.id !== card.id)?.term ?? 'anders');
  const packet = buildPacket(2);
  const [order, setOrder] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Record<string, 'tcp' | 'udp'>>({});
  if (drill === 'spot' && spot) {
    return (
      <View style={styles.block}>
        <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.spotTitle}</Text>
        {spot.words.map((word, index) => (
          <Pressable key={`${word}-${index}`} accessibilityRole="button" onPress={() => onDone(index === spot.wrongIndex)} style={[styles.choice, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text }}>{word}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  if (drill === 'sequence') {
    const round = /client|server|dns|anfrage/i.test(`${card.term} ${card.definition}`) ? packet : sequence;
    if (!round) return null;
    const labels = round.shuffled.map((term) => (
      'term' in term ? { id: term.id, label: term.term } : { id: term.id, label: term.label }
    ));
    return (
      <View style={styles.block}>
        <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.sequenceTitle}</Text>
        {labels.map((term) => (
          <Pressable key={term.id} accessibilityRole="button" onPress={() => setOrder((current) => current.includes(term.id) ? current : [...current, term.id])} style={[styles.choice, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text }}>{term.label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => onDone(sequenceIsCorrect(order, round.expected))} style={styles.button}>
          <Text style={{ color: theme.colors.text }}>{de.learn.sequenceDone}</Text>
        </Pressable>
      </View>
    );
  }
  if (drill === 'contrast' && /tcp|udp/i.test(`${card.term} ${card.definition}`)) {
    return (
      <View style={styles.block}>
        <Text style={[styles.prompt, { color: theme.colors.text }]}>{de.learn.columnsTitle}</Text>
        {TCP_UDP.map((fact) => (
          <View key={fact.id} style={styles.block}>
            <Text style={[styles.body, { color: theme.colors.text }]}>{fact.label}</Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => setPlaced((current) => ({ ...current, [fact.id]: 'tcp' }))} style={[styles.choice, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>TCP{placed[fact.id] === 'tcp' ? ' ·' : ''}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPlaced((current) => ({ ...current, [fact.id]: 'udp' }))} style={[styles.choice, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>UDP{placed[fact.id] === 'udp' ? ' ·' : ''}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={() => onDone(columnsAreCorrect(placed))} style={styles.button}>
          <Text style={{ color: theme.colors.text }}>{de.learn.check}</Text>
        </Pressable>
      </View>
    );
  }
  const clause = exampleClause(card.definition);
  const choices = shuffle([card, ...pool.filter((entry) => entry.id !== card.id)].slice(0, 4), 8);
  return (
    <View style={styles.block}>
      <Text style={[styles.prompt, { color: theme.colors.text }]}>{clause ? de.learn.examplePrompt(clause) : de.learn.optionsPrompt}</Text>
      {choices.map((entry) => (
        <Pressable key={entry.id} accessibilityRole="button" onPress={() => onDone(entry.id === card.id)} style={[styles.choice, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>{entry.term}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Choice({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.choice, { borderColor: theme.colors.border }]}>
      <Text style={[styles.prompt, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.body, { color: theme.colors.textWeak }]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 16 },
  block: { gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  prompt: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  button: { minHeight: 48, justifyContent: 'center' },
  choice: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
});
