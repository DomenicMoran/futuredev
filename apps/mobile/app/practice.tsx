import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { Lesson } from '@futuredev/content-schema';
import { useContent } from '../src/content/ContentProvider.js';
import { getContentFs } from '../src/content/contentFs.js';
import { loadLesson } from '../src/content/lessonLoader.js';
import { useTheme } from '../src/theme/useTheme.js';
import { useBottomChromeInset } from '../src/navigation/useBottomChromeInset.js';
import {
  canCompletePractice,
  loadPractice,
  savePractice,
  type PracticeEvidence,
} from '../src/mastery/practice.js';

export default function PracticeScreen() {
  const theme = useTheme();
  const bottom = useBottomChromeInset();
  const params = useLocalSearchParams<{ moduleId?: string; lessonId?: string }>();
  const { moduleList } = useContent();
  const [selected, setSelected] = useState<string | null>(
    typeof params.lessonId === 'string' ? params.lessonId : null,
  );
  const [moduleId, setModuleId] = useState(
    typeof params.moduleId === 'string' ? params.moduleId : '',
  );
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState<PracticeEvidence | null>(null);
  const [dirty, setDirty] = useState(false);
  const [solution, setSolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [retry, setRetry] = useState(0);
  const previousRoute = useRef({ lessonId: params.lessonId, moduleId: params.moduleId });
  useEffect(() => {
    if (busy) return;
    if (
      previousRoute.current.lessonId === params.lessonId &&
      previousRoute.current.moduleId === params.moduleId
    )
      return;
    previousRoute.current = { lessonId: params.lessonId, moduleId: params.moduleId };
    const applyRoute = () => {
      setDirty(false);
      setSelected(typeof params.lessonId === 'string' ? params.lessonId : null);
      setModuleId(typeof params.moduleId === 'string' ? params.moduleId : '');
    };
    if (!dirty) applyRoute();
    else
      Alert.alert(
        'Ungespeicherter Entwurf',
        'Die neue Aufgabe öffnen und den ungespeicherten Entwurf verwerfen?',
        [
          { text: 'Hier bleiben', style: 'cancel' },
          { text: 'Änderungen verwerfen', style: 'destructive', onPress: applyRoute },
        ],
      );
  }, [params.lessonId, params.moduleId, busy, dirty]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (busy) return true;
        if (!dirty) return false;
        Alert.alert(
          'Ungespeicherter Entwurf',
          'Speichere den Entwurf, bevor du die Aufgabe verlässt.',
          [
            { text: 'Hier bleiben', style: 'cancel' },
            { text: 'Änderungen verwerfen', style: 'destructive', onPress: () => router.back() },
          ],
        );
        return true;
      });
      return () => sub.remove();
    }, [dirty, busy]),
  );
  useEffect(() => {
    let active = true;
    setLesson(null);
    setDraft(null);
    setError('');
    setSolution(false);
    setFeedback('');
    if (selected)
      void (async () => {
        try {
          const value = await loadLesson(await getContentFs(), selected);
          if (!value) throw new Error('Diese Lektion ist nicht verfügbar.');
          const saved = await loadPractice(value);
          if (active) {
            setLesson(value);
            setDraft(saved);
            setDirty(false);
          }
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.');
        }
      })();
    return () => {
      active = false;
    };
  }, [selected, retry]);
  const text = { color: theme.colors.text, fontSize: 16, lineHeight: 25 };
  const muted = { ...text, color: theme.colors.textWeak };
  const heading = { ...text, fontSize: 23, lineHeight: 31, fontWeight: '700' as const };
  const card = {
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  };
  const button = (label: string, action: () => void, disabled = false, selected = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, selected }}
      disabled={busy || disabled}
      onPress={action}
      style={{
        minHeight: theme.minTapTarget,
        padding: 14,
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        opacity: busy || disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ ...text, color: selected ? theme.colors.accent : theme.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
  function edit(patch: Partial<PracticeEvidence>) {
    if (draft) {
      setDraft({ ...draft, ...patch, completedAt: null });
      setDirty(true);
      setFeedback('');
    }
  }
  async function save(complete = false) {
    if (!lesson || !draft || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const next = {
        ...draft,
        completedAt: complete ? new Date().toISOString() : draft.completedAt,
      };
      await savePractice(lesson, next);
      setDraft(next);
      setDirty(false);
      setFeedback(
        complete
          ? 'Als selbst geprüft gespeichert. Kein automatisch benoteter Kompetenznachweis.'
          : 'Entwurf gespeichert.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nicht gespeichert. Bitte erneut versuchen.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function leave(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    Alert.alert(
      'Ungespeicherter Entwurf',
      'Speichere den Entwurf, bevor du die Aufgabe verlässt.',
      [
        { text: 'Hier bleiben', style: 'cancel' },
        {
          text: 'Änderungen verwerfen',
          style: 'destructive',
          onPress: () => {
            setDirty(false);
            action();
          },
        },
      ],
    );
  }
  const modules = moduleId ? moduleList.filter((m) => m.id === moduleId) : moduleList;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: bottom + 24, gap: 16 }}
        >
          {button(selected ? 'Zur Aufgabenauswahl' : 'Zurück zum Lernkreislauf', () =>
            leave(() => (selected ? setSelected(null) : router.replace('/mastery'))),
          )}
          <Text accessibilityRole="header" style={heading}>
            Praxis & Erklären
          </Text>
          <Text style={muted}>
            Auswendig auswählen ist nicht dasselbe wie anwenden. Erkläre zuerst ohne Vorlage,
            bearbeite die Aufgabe und vergleiche dein Ergebnis. Audio-Wiederholung bleibt frei
            wählbar; Praxis wird separat dokumentiert.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={{ ...text, color: theme.colors.error }}>
              {error}
            </Text>
          ) : null}
          {feedback ? (
            <Text accessibilityLiveRegion="polite" style={text}>
              {feedback}
            </Text>
          ) : null}
          {!selected ? (
            modules.length === 0 ? (
              <View style={card}>
                <Text style={text}>Dieses Modul ist nicht verfügbar.</Text>
                {button('Alle Module anzeigen', () => setModuleId(''))}
              </View>
            ) : (
              modules.map((m) => (
                <View key={m.id} style={card}>
                  {button(
                    `${m.id} · ${m.title}`,
                    () => setModuleId(moduleId === m.id ? '' : m.id),
                    false,
                    moduleId === m.id,
                  )}
                  {moduleId === m.id
                    ? m.subModules
                        .flatMap((s) => s.lessons)
                        .map((l) => button(l.title, () => setSelected(l.id)))
                    : null}
                </View>
              ))
            )
          ) : !lesson || !draft ? (
            error ? (
              <View style={{ gap: 12 }}>
                {button('Erneut laden', () => setRetry(retry + 1))}
                {button('Datensicherung importieren', () => router.push('/settings'))}
              </View>
            ) : (
              <ActivityIndicator
                accessibilityLabel="Praxisaufgabe laden"
                color={theme.colors.accent}
              />
            )
          ) : (
            <>
              <Text accessibilityRole="header" style={heading}>
                {lesson.title}
              </Text>
              <View style={card}>
                <Text accessibilityRole="header" style={heading}>
                  1 · Selbst erklären
                </Text>
                <Text style={text}>
                  Erkläre das Thema an einem eigenen Beispiel. Wie funktioniert es, wann würdest du
                  es verwenden und welcher typische Fehler wäre zu vermeiden?
                </Text>
                <Text style={muted}>
                  Schreibe mindestens 40 Zeichen oder markiere deine mündliche Erklärung. Beides ist
                  eine Selbsteinschätzung, keine automatische Bewertung.
                </Text>
                <TextInput
                  accessibilityLabel="Meine Erklärung und mein Ergebnis"
                  multiline
                  maxLength={20000}
                  editable={!busy}
                  value={draft.explanation}
                  onChangeText={(explanation) => edit({ explanation })}
                  placeholder="Eigene Erklärung, Ergebnis oder Link zu deinem Nachweis …"
                  placeholderTextColor={theme.colors.textWeak}
                  style={{
                    ...text,
                    minHeight: 160,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    textAlignVertical: 'top',
                  }}
                />
                {button(
                  'Ich habe das Thema frei mündlich erklärt',
                  () => edit({ spoken: !draft.spoken }),
                  false,
                  draft.spoken,
                )}
                {button(
                  'Entwurf speichern',
                  () => {
                    void save();
                  },
                  !dirty,
                )}
                {button(solution ? 'Vergleich ausblenden' : 'Mit dem Lerninhalt vergleichen', () =>
                  setSolution(!solution),
                )}
                {solution ? (
                  <Text style={text}>
                    {lesson.speechBlocks.find((b) => b.isKeySentence)?.text}
                    {'\n\n'}
                    {lesson.faq[0]?.question}
                    {'\n'}
                    {lesson.faq[0]?.answer}
                  </Text>
                ) : null}
              </View>
              <View style={card}>
                <Text accessibilityRole="header" style={heading}>
                  2 · Praktisch anwenden
                </Text>
                <Text style={text}>{lesson.practiceTask.task}</Text>
                <Text style={{ ...text, fontWeight: '600' }}>Erwartetes Ergebnis</Text>
                <Text style={text}>{lesson.practiceTask.expectation}</Text>
                {lesson.practiceTask.checklist.map((label, i) =>
                  button(
                    `${draft.checked.includes(i) ? '✓ ' : ''}${label}`,
                    () =>
                      edit({
                        checked: draft.checked.includes(i)
                          ? draft.checked.filter((n) => n !== i)
                          : [...draft.checked, i],
                      }),
                    false,
                    draft.checked.includes(i),
                  ),
                )}
                <Text style={muted}>
                  Hake nur tatsächlich überprüfte Punkte ab. Ein Häkchen bewertet weder Code noch
                  Erklärung automatisch.
                </Text>
                {button(
                  'Praxis als selbst geprüft speichern',
                  () => {
                    void save(true);
                  },
                  !canCompletePractice(draft, lesson) || Boolean(draft.completedAt),
                )}
                {draft.completedAt ? (
                  <Text style={text}>
                    Selbst geprüft am {new Date(draft.completedAt).toLocaleDateString('de-DE')}.
                    Änderungen öffnen die Aufgabe wieder.
                  </Text>
                ) : null}
                {button('Lektion lesen oder hören', () =>
                  leave(() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })),
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
