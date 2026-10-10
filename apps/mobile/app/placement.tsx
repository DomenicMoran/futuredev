import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme.js';
import { useContent } from '../src/content/ContentProvider.js';
import { useBottomChromeInset } from '../src/navigation/useBottomChromeInset.js';
import { PLACEMENT_QUESTIONS, assess, recommendedLesson, type Answers, type PlacementResult } from '../src/placement/assessment.js';
import { loadPlacement, savePlacement } from '../src/placement/persistence.js';

export default function PlacementScreen() {
  const theme = useTheme();
  const { moduleList } = useContent();
  const bottomInset = useBottomChromeInset();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    loadPlacement().then(r => { if (active) setResult(r); }).catch(() => { if (active) setError('Die gespeicherte Einstufung konnte nicht geladen werden. Du kannst den Check neu starten.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function persist(next: PlacementResult): Promise<boolean> {
    if (saving.current) return false;
    saving.current = true; setBusy(true); setError('');
    try { await savePlacement(next); setResult(next); return true; }
    catch { setError('Speichern fehlgeschlagen. Bitte erneut versuchen; dein bisheriges Ergebnis bleibt erhalten.'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  async function advance() {
    if (index === null || selected === null || saving.current) return;
    const q = PLACEMENT_QUESTIONS[index];
    if (!q) return;
    const next = { ...answers, [q.id]: selected };
    if (index === PLACEMENT_QUESTIONS.length - 1) {
      if (await persist({ version: 1, completedAt: new Date().toISOString(), answers: next, skipKnown: false })) { setIndex(null); setAnswers({}); setSelected(null); }
    } else { setAnswers(next); setIndex(index + 1); setSelected(null); }
  }
  function cancel() { setIndex(null); setAnswers({}); setSelected(null); setError(''); }
  function start() { cancel(); setIndex(0); }
  const q = index === null ? null : PLACEMENT_QUESTIONS[index] ?? null;
  const topics = result ? assess(result.answers) : [];
  const target = recommendedLesson(result, moduleList);
  const button = (label: string, onPress: () => void, disabled = false, selectedOption = false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, selected: selectedOption }} disabled={disabled || busy} onPress={onPress} style={{ padding: 16, minHeight: theme.minTapTarget, borderRadius: theme.radius.md, borderWidth: selectedOption ? 2 : 1, borderColor: selectedOption ? theme.colors.accent : theme.colors.border, backgroundColor: theme.colors.surface, opacity: disabled || busy ? 0.5 : 1 }}><Text style={{ fontSize: 16, lineHeight: 24, color: selectedOption ? theme.colors.accent : theme.colors.text }}>{label}</Text></Pressable>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 14 }}>
    <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700', color: theme.colors.text }}>Dein Grundlagen-Check</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Einstufung laden" color={theme.colors.accent} /> : q ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textWeak }}>Frage {(index ?? 0) + 1} von {PLACEMENT_QUESTIONS.length} · {q.title}</Text>
      <Text accessibilityRole="header" style={{ fontSize: 20, lineHeight: 28, color: theme.colors.text }}>{q.prompt}</Text>
      {q.options.map((option, i) => button(option, () => setSelected(i), false, selected === i))}
      {button('Weiß ich noch nicht', () => setSelected(-1), false, selected === -1)}
      {button(index === PLACEMENT_QUESTIONS.length - 1 ? 'Ergebnis anzeigen' : 'Weiter', () => { void advance(); }, selected === null)}
      {(index ?? 0) > 0 ? button('Vorherige Frage', () => { const previous = (index ?? 0) - 1; setIndex(previous); const previousQuestion = PLACEMENT_QUESTIONS[previous]; setSelected(previousQuestion ? answers[previousQuestion.id] ?? null : null); }) : null}
      {button('Check abbrechen – bisheriges Ergebnis behalten', cancel)}
    </> : result ? <>
      <Text style={{ color: theme.colors.text, fontSize: 17 }}>Deine Orientierung: {topics.filter(t => t.known).length} von {topics.length} Grundlagenbereichen mit 2 von 2 richtigen Antworten.</Text>
      <Text style={{ color: theme.colors.textWeak, lineHeight: 22 }}>Nur eine Stichprobe, kein Kompetenznachweis. Geprüft wurden Computer-Grundlagen, nicht Webentwicklung oder spätere Module. Du kannst bekannte Bereiche beim empfohlenen Einstieg auslassen. Nichts wird als gelesen, gehört oder bestanden markiert; alle Lektionen bleiben zugänglich.</Text>
      {topics.map(t => <View key={t.topic} style={{ gap: 4, paddingVertical: 6 }}><Text style={{ color: theme.colors.text, fontWeight: '600' }}>{t.title}: {t.correct}/{t.total}</Text><Text style={{ color: theme.colors.textWeak }}>{t.known ? 'Hinweis auf Vorkenntnisse – optional auslassen' : 'Zum Lernen oder Wiederholen empfohlen'}</Text></View>)}
      {button(result.skipKnown ? 'Bekannte Grundlagen auslassen: an · ausschalten' : 'Bekannte Grundlagen auslassen: aus · einschalten', () => { void persist({ ...result, skipKnown: !result.skipKnown }); }, !topics.some(t => t.known), result.skipKnown)}
      <Text style={{ color: theme.colors.textWeak }}>{target ? `Dein Einstieg: ${moduleList.flatMap(m => m.subModules.flatMap(s => s.lessons)).find(l => l.id === target)?.title ?? target}` : 'Noch keine passende veröffentlichte Lektion verfügbar. Alle Module findest du unter Lernen.'}</Text>
      {target ? button('Empfohlene Lektion öffnen', () => router.replace(`/lesson/${target}`)) : null}
      {button('Check erneut machen', start)}
      {button('Alle Module ansehen', () => router.replace('/(tabs)/lernen'))}
    </> : <>
      <Text style={{ color: theme.colors.text, fontSize: 17, lineHeight: 25 }}>Schon Vorkenntnisse? Finde einen passenden Einstieg.</Text>
      <Text style={{ color: theme.colors.textWeak, lineHeight: 23 }}>14 Fragen, etwa 5 Minuten. Je zwei Fragen zu sieben Computer-Grundlagenbereichen. Dies ist eine unverbindliche Stichprobe, keine vollständige Einstufung deiner Entwicklerkenntnisse. Anschließend kannst du bekannte Grundlagen beim Einstieg optional auslassen.</Text>
      <Text style={{ color: theme.colors.textWeak, lineHeight: 23 }}>Ohne Vorkenntnisse kannst du direkt beginnen. Der Check ist freiwillig und jederzeit unter Lernen erreichbar. Nur abgeschlossene Checks werden lokal gespeichert; ein Abbruch verändert keinen Lernfortschritt.</Text>
      {button('Grundlagen-Check starten', start)}
      {button('Ohne Check mit den Grundlagen starten', () => { const first = recommendedLesson(null, moduleList); router.replace(first ? `/lesson/${first}` : '/(tabs)/lernen'); })}
      {button('Später – alle Module ansehen', () => router.replace('/(tabs)/lernen'))}
    </>}
    {busy ? <ActivityIndicator accessibilityLabel="Ergebnis speichern" color={theme.colors.accent} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}
