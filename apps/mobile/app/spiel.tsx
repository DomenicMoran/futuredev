import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/useTheme.js';
import { de } from '../src/i18n/de.js';
import { loadFlashcardDeck } from '../src/flashcards/deck.js';
import type { FlashcardEntry } from '../src/flashcards/types.js';
import { buildConfusableMatch, buildMatchRound, buildOddRound, buildPacket, buildSequence, buildSpot, columnsAreCorrect, sequenceIsCorrect, TCP_UDP, type MatchRound, type OddRound } from '../src/learn/games.js';

type Mode = 'match' | 'odd' | 'sequence' | 'packet' | 'spot' | 'columns';

export default function SpielScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('match');
  const [seed, setSeed] = useState(1);
  const [terms, setTerms] = useState<FlashcardEntry[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [placed, setPlaced] = useState<Record<string, 'tcp' | 'udp'>>({});

  useEffect(() => {
    let active = true;
    loadFlashcardDeck()
      .then((deck) => {
        if (active) setTerms(deck);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const match: MatchRound | null = useMemo(() => buildConfusableMatch(terms, seed) ?? buildMatchRound(terms, seed), [terms, seed]);
  const odd: OddRound | null = useMemo(() => buildOddRound(terms, seed), [terms, seed]);
  const sequence = useMemo(() => buildSequence(terms, seed), [terms, seed]);
  const packet = useMemo(() => buildPacket(seed), [seed]);
  const spot = useMemo(() => {
    const host = terms[seed % Math.max(terms.length, 1)];
    const intruder = terms[(seed + 3) % Math.max(terms.length, 1)];
    if (!host || !intruder || host.id === intruder.id) return null;
    return buildSpot(host.definition, intruder.term);
  }, [terms, seed]);

  function reset(nextSeed: number) {
    setSeed(nextSeed);
    setPicked(null);
    setOrder([]);
    setVerdict(null);
    setPlaced({});
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{de.ueben.spielTitle}</Text>
        <View style={styles.row}>
          <ModeButton label={de.learn.matchTitle} selected={mode === 'match'} onPress={() => { setMode('match'); reset(seed + 1); }} />
          <ModeButton label={de.learn.oddTitle} selected={mode === 'odd'} onPress={() => { setMode('odd'); reset(seed + 1); }} />
          <ModeButton label={de.learn.sequenceTitle} selected={mode === 'sequence'} onPress={() => { setMode('sequence'); reset(seed + 1); }} />
          <ModeButton label={de.learn.packetTitle} selected={mode === 'packet'} onPress={() => { setMode('packet'); reset(seed + 1); }} />
          <ModeButton label={de.learn.spotTitle} selected={mode === 'spot'} onPress={() => { setMode('spot'); reset(seed + 1); }} />
          <ModeButton label={de.learn.columnsTitle} selected={mode === 'columns'} onPress={() => { setMode('columns'); reset(seed + 1); }} />
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{de.learn.loadError}</Text> : null}
        {mode === 'match' && match ? (
          <View>
            <Text style={[styles.body, { color: theme.colors.text }]}>{match.prompt}</Text>
            {match.choices.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={choice.label}
                onPress={() => { setPicked(choice.id); setVerdict(choice.id === match.answerId); }}
                style={[styles.choice, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text }}>{choice.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {mode === 'odd' && odd ? (
          <View>
            <Text style={[styles.body, { color: theme.colors.text }]}>{odd.prompt}</Text>
            {odd.choices.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={choice.label}
                onPress={() => { setPicked(choice.id); setVerdict(choice.outsider); }}
                style={[styles.choice, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text }}>{choice.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {mode === 'sequence' && sequence ? (
          <View>
            <Text style={[styles.body, { color: theme.colors.text }]}>{de.learn.sequenceTitle}</Text>
            {sequence.shuffled.map((term) => (
              <Pressable
                key={term.id}
                accessibilityRole="button"
                accessibilityLabel={term.term}
                onPress={() => setOrder((current) => current.includes(term.id) ? current : [...current, term.id])}
                style={[styles.choice, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text }}>{order.indexOf(term.id) >= 0 ? `${order.indexOf(term.id) + 1}. ` : ''}{term.term}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setVerdict(sequenceIsCorrect(order, sequence.expected))}
              style={styles.choice}
            >
              <Text style={{ color: theme.colors.text }}>{de.learn.sequenceDone}</Text>
            </Pressable>
          </View>
        ) : null}
        {mode === 'packet' ? (
          <View>
            {packet.shuffled.map((step) => (
              <Pressable key={step.id} accessibilityRole="button" accessibilityLabel={step.label} onPress={() => setOrder((current) => current.includes(step.id) ? current : [...current, step.id])} style={[styles.choice, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>{order.indexOf(step.id) >= 0 ? `${order.indexOf(step.id) + 1}. ` : ''}{step.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setVerdict(sequenceIsCorrect(order, packet.expected))} style={styles.choice}>
              <Text style={{ color: theme.colors.text }}>{de.learn.sequenceDone}</Text>
            </Pressable>
          </View>
        ) : null}
        {mode === 'spot' && spot ? (
          <View>
            {spot.words.map((word, index) => (
              <Pressable key={`${word}-${index}`} accessibilityRole="button" onPress={() => { setPicked(String(index)); setVerdict(index === spot.wrongIndex); }} style={[styles.choice, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text }}>{word}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {mode === 'columns' ? (
          <View>
            {TCP_UDP.map((fact) => (
              <View key={fact.id}>
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
            <Pressable accessibilityRole="button" onPress={() => setVerdict(columnsAreCorrect(placed))} style={styles.choice}>
              <Text style={{ color: theme.colors.text }}>{de.learn.check}</Text>
            </Pressable>
          </View>
        ) : null}
        {verdict !== null ? (
          <Text style={[styles.body, { color: theme.colors.text }]}>{verdict ? de.learn.correct : de.learn.incorrect}</Text>
        ) : null}
        {picked || verdict !== null ? (
          <Pressable accessibilityRole="button" onPress={() => reset(seed + 3)} style={styles.choice}>
            <Text style={{ color: theme.colors.text }}>{de.learn.next}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { borderColor: selected ? theme.colors.text : theme.colors.border }]}>
      <Text style={{ color: theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  row: { gap: 8 },
  choice: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
});
