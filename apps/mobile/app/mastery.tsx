import {
  clearReviewHearing,
  listReviewHearingProgress,
  type HearingProgress,
} from '../src/player/hearingProgress.js';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme/useTheme.js';
import { useContent } from '../src/content/ContentProvider.js';
import { useBottomChromeInset } from '../src/navigation/useBottomChromeInset.js';
import { loadMasteryBank } from '../src/mastery/content.js';
import {
  answer,
  begin,
  finish,
  summary,
  type BankQuestion,
  type MasteryState,
  type Medium,
} from '../src/mastery/engine.js';
import { loadMastery, saveMastery } from '../src/mastery/persistence.js';
import { saveReviewPlaylist } from '../src/mastery/playlist.js';
import { applyRepeatMode, playLesson, playPlaylist, usePlayerStore } from '../src/player/index.js';
import { persistAutoplayNext } from '../src/player/playerPreferences.js';
import { batchDownloads } from '../src/player/batchDownloads.js';

export default function MasteryScreen() {
  const theme = useTheme();
  const { moduleList } = useContent();
  const bottom = useBottomChromeInset();
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [state, setState] = useState<MasteryState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [exam, setExam] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [details, setDetails] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [heard, setHeard] = useState<Record<string, HearingProgress>>({});
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void listReviewHearingProgress()
          .then((value) => {
            if (active) setHeard(value);
          })
          .catch(() => {
            if (active)
              setError(
                'Hörfortschritt konnte nicht geladen werden. Bitte die Ansicht erneut öffnen.',
              );
          });
      };
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );
  const downloads = useSyncExternalStore(batchDownloads.subscribe, batchDownloads.getSnapshot);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [next, saved] = await Promise.all([loadMasteryBank(), loadMastery()]);
      if (!next.length) throw new Error('Noch keine Prüfungsfragen verfügbar.');
      setBank(next);
      setState(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const stats = useMemo(() => (state ? summary(state, bank) : null), [state, bank]);
  const byKey = useMemo(() => new Map(bank.map((q) => [q.key, q])), [bank]);
  const lessons = useMemo(
    () =>
      moduleList.flatMap((m) =>
        m.subModules.flatMap((s) =>
          s.lessons.map((l) => ({ ...l, section: `${m.title} · ${s.title}` })),
        ),
      ),
    [moduleList],
  );
  const weakIds = useMemo(
    () => [...new Set(stats?.wrong.map((q) => q.sourceLessonId) ?? [])].sort(),
    [stats],
  );
  const pendingIds = weakIds.filter((id) => !state?.reviewed.includes(id) && !heard[id]?.completed);
  const session = state?.session;
  const index = session?.answers.length ?? 0;
  const question = session ? byKey.get(session.keys[index] ?? '') : undefined;
  const last = state?.history.at(-1);
  const remainingCount = session ? session.keys.length - index : (stats?.remaining ?? 0);
  const timeEstimate =
    remainingCount >= 120
      ? `${Math.ceil(remainingCount / 120)}–${Math.ceil(remainingCount / 60)} Stunden`
      : remainingCount === 1
        ? '30–60 Sekunden'
        : `${Math.ceil(remainingCount / 2)}–${remainingCount} Minuten`;
  async function commit(next: MasteryState): Promise<boolean> {
    try {
      await saveMastery(next);
      setState(next);
      return true;
    } catch {
      setError(
        'Nicht gespeichert. Bitte erneut versuchen. Deine letzte gespeicherte Antwort bleibt erhalten.',
      );
      return false;
    }
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt. Bitte erneut versuchen.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const resetScroll = () => scroll.current?.scrollTo({ y: 0, animated: false });
  async function submit() {
    if (!state || choice === null) return;
    const next = answer(state, choice, bank);
    const done = next.session?.answers.length === next.session?.keys.length;
    if (await commit(done ? finish(next, bank) : next)) {
      setChoice(null);
      if (done) {
        setExam(false);
        setHeard({});
      }
      resetScroll();
    }
  }
  async function evaluate() {
    if (state && (await commit(finish(state, bank)))) {
      setExam(false);
      setChoice(null);
      setHeard({});
      resetScroll();
    }
  }
  async function start(full = false) {
    if (!state) return;
    if (await commit(begin(state, bank, full))) {
      setExam(true);
      setChoice(null);
      resetScroll();
    }
  }
  async function audio() {
    const ids = pendingIds.length ? pendingIds : weakIds;
    const id = await saveReviewPlaylist(ids);
    // The button explicitly promises continuous playback from the beginning.
    await applyRepeatMode('off');
    await persistAutoplayNext(true);
    usePlayerStore.getState().setAutoplayNext(true);
    await playPlaylist(id);
    router.push('/player');
  }
  const text = { color: theme.colors.text, fontSize: 16, lineHeight: 24 };
  const muted = { ...text, color: theme.colors.textWeak, fontSize: 14, lineHeight: 21 };
  const heading = { ...text, fontSize: 21, lineHeight: 28, fontWeight: '700' as const };
  const card = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  };
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
    selected = false,
    testID?: string,
  ) => (
    <Pressable
      key={label}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, selected }}
      disabled={disabled || busy}
      onPress={action}
      style={{
        minHeight: theme.minTapTarget,
        padding: 14,
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected || primary ? theme.colors.accent : theme.colors.border,
        backgroundColor: primary ? theme.colors.accent : theme.colors.surface,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          ...text,
          color: primary
            ? theme.colors.accentText
            : selected
              ? theme.colors.accent
              : theme.colors.text,
          fontWeight: primary ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 20, paddingBottom: bottom + 24, gap: 16 }}
      >
        {button(exam ? 'Pausieren · zum Überblick' : 'Zurück zu Üben', () => {
          if (exam) {
            setExam(false);
            setChoice(null);
            setHeard({});
            resetScroll();
          } else router.replace('/(tabs)/ueben');
        })}
        <Text accessibilityRole="header" style={{ ...heading, fontSize: 28, lineHeight: 34 }}>
          Dein Lernkreislauf
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={{ ...text, color: theme.colors.error }}>
            {error}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Fragen und Fortschritt laden"
            color={theme.colors.accent}
          />
        ) : !state || !stats ? (
          button('Erneut laden', () => {
            void load();
          })
        ) : exam && session ? (
          <>
            <Text accessibilityLiveRegion="polite" style={muted}>
              {index} von {session.keys.length} Antworten gespeichert · Lösungen erst nach der
              Auswertung
            </Text>
            {question ? (
              <View style={card}>
                <Text style={muted}>
                  {lessons.find((l) => l.id === question.sourceLessonId)?.title ??
                    question.sourceLessonId}
                </Text>
                <Text accessibilityRole="header" style={heading}>
                  {question.question}
                </Text>
                {(session.orders[index] ?? []).map((original) =>
                  button(
                    question.options[original]?.text ?? 'Antwort nicht verfügbar',
                    () => setChoice(original),
                    false,
                    false,
                    choice === original,
                    `mastery-option-${original}`,
                  ),
                )}
                {button(
                  'Weiß ich noch nicht',
                  () => setChoice(-1),
                  false,
                  false,
                  choice === -1,
                  'mastery-unknown',
                )}
                {button(
                  index + 1 === session.keys.length
                    ? 'Antwort speichern und auswerten'
                    : 'Antwort speichern · weiter',
                  () => {
                    void run(submit);
                  },
                  true,
                  choice === null,
                  false,
                  'mastery-submit',
                )}
              </View>
            ) : (
              <Text style={text}>
                Der Fragenbestand hat sich geändert oder die Runde ist abgeschlossen. Werte die
                gespeicherten Antworten aus; geänderte Fragen bleiben offen.
              </Text>
            )}
            <Text style={muted}>
              Jede bestätigte Antwort wird auf diesem Gerät gespeichert. Du kannst die App schließen
              und später fortsetzen. Die aktuelle, noch nicht bestätigte Auswahl wird beim Verlassen
              verworfen.
            </Text>
            {button(
              'Zwischenstand auswerten',
              () =>
                Alert.alert(
                  'Jetzt auswerten?',
                  'Nur gespeicherte Antworten werden bewertet. Unbeantwortete Fragen bleiben für die nächste Prüfung offen.',
                  [
                    { text: 'Weiter prüfen', style: 'cancel' },
                    {
                      text: 'Auswerten',
                      onPress: () => {
                        void run(evaluate);
                      },
                    },
                  ],
                ),
              false,
              index === 0,
            )}
            {!question && index === 0
              ? button('Veraltete Runde schließen', () => {
                  void run(async () => {
                    if (await commit({ ...state, session: null })) setExam(false);
                  });
                })
              : null}
          </>
        ) : (
          <>
            <View style={card}>
              <Text style={{ ...muted, color: theme.colors.accent, fontWeight: '700' }}>
                HÖREN / LESEN → PRÜFEN → GEZIELT WIEDERHOLEN
              </Text>
              <Text accessibilityRole="header" style={{ ...heading, fontSize: 36, lineHeight: 44 }}>
                {stats.percent} % geprüft richtig
              </Text>
              <View
                accessible
                accessibilityLabel={`${stats.passed} von ${bank.length} Fragen zuletzt richtig beantwortet`}
                style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border }}
              >
                <View
                  style={{
                    width: `${stats.percent}%`,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.colors.accent,
                  }}
                />
              </View>
              <Text style={text}>
                {stats.passed} von {bank.length} Fragen zuletzt richtig
              </Text>
              <Text style={muted}>
                {stats.unseen} ungeprüft · {stats.wrong.length} zu festigen ·{' '}
                {new Set(bank.map((q) => q.sourceLessonId)).size} Lektionen im Fragenbestand
              </Text>
              <Text style={muted}>
                100 % bedeutet: alle Fragen des aktuellen Bestands zuletzt richtig beantwortet. Das
                ist keine Garantie für dauerhaftes Können. Praxisaufgaben und spätere
                Gesamtprüfungen gehören weiterhin dazu.
              </Text>
            </View>
            <View style={card}>
              <Text accessibilityRole="header" style={heading}>
                {session
                  ? 'Deine Prüfung wartet auf dich'
                  : stats.remaining
                    ? '1 · Wissen prüfen'
                    : 'Alles im Fragenbestand richtig'}
              </Text>
              <Text style={text}>
                {session
                  ? `${session.answers.length} von ${session.keys.length} Antworten gespeichert. Du verlierst beim Pausieren nichts Bestätigtes.`
                  : stats.remaining
                    ? `${stats.remaining} ${stats.remaining === 1 ? 'offene Frage' : 'offene Fragen'}. Keine Stichprobe: Jede Frage wird berücksichtigt, auch aus noch nicht gehörten Lektionen.`
                    : 'Deine Wiederholung ist abgeschlossen. Festige dein Wissen jetzt mit Praxisaufgaben und prüfe später den ganzen Bestand erneut. Neue Lücken erscheinen dann wieder hier.'}
              </Text>
              {remainingCount > 0 ? (
                <Text style={muted}>
                  Für alle verbleibenden Fragen etwa {timeEstimate}, bei 30–60 Sekunden je Frage.
                  Plane einzelne Sitzungen von 1–2 Stunden oder kürzer. Du kannst jederzeit
                  pausieren oder einen Zwischenstand auswerten, ohne den Rest als bestanden zu
                  zählen.
                </Text>
              ) : null}
              {session
                ? button(
                    'Prüfung fortsetzen',
                    () => {
                      setExam(true);
                      resetScroll();
                    },
                    true,
                  )
                : stats.remaining
                  ? button(
                      state.history.length
                        ? 'Offene Fragen erneut prüfen'
                        : 'Gesamtprüfung starten',
                      () => {
                        void run(() => start());
                      },
                      true,
                    )
                  : null}
              {!session && state.history.length
                ? button('Alles erneut prüfen', () => {
                    void run(() => start(true));
                  })
                : null}
              {button(help ? 'Anleitung schließen' : 'So funktioniert es', () => setHelp(!help))}
              {help ? (
                <Text style={text}>
                  1. Höre oder lies die Lektionen, wann und wie du magst. Eine Prüfung ist jederzeit
                  möglich, ohne Freischaltsperre.{'\n\n'}2. Beantworte die Fragen ohne
                  nachzuschlagen. „Weiß ich noch nicht“ zählt als Lücke, nicht als Fehler beim
                  Bedienen.{'\n\n'}3. Nach der Auswertung erhältst du die Lektionen zu deinen
                  falschen Antworten. Höre sie am Stück, lies sie oder kombiniere beides. Nur Hören
                  ist vollkommen in Ordnung.{'\n\n'}4. Vollständig erneut gehörte Lektionen werden
                  automatisch abgehakt; Vorspulen zählt nicht. Du kannst Wiederholtes auch manuell
                  abhaken. Das ist nur deine Merkliste, kein Wissensnachweis. Prüfe danach die
                  offenen Fragen erneut. Richtige Antworten entfallen; ungeprüfte Fragen bleiben
                  dabei.{'\n\n'}5. Wiederhole, bis alle Fragen richtig waren. Prüfe später auch
                  wieder den ganzen Bestand: vergessene Antworten kommen zurück in die Wiederholung.
                  Neue oder geänderte Fragen zählen wieder als ungeprüft.{'\n\n'}Prüfungen nur im
                  Stand, niemals beim Fahren. Audio vor der Fahrt starten. Fortschritt liegt lokal
                  und ist über Einstellungen → Datenexport sicherbar.
                </Text>
              ) : null}
            </View>
            {last ? (
              <View style={card}>
                <Text accessibilityRole="header" style={heading}>
                  Letzte Auswertung
                </Text>
                <Text style={text}>
                  {last.correct} von {last.total} richtig ·{' '}
                  {new Date(last.at).toLocaleDateString('de-DE')}
                </Text>
                <Text style={muted}>
                  Offene Fragen nach deinen letzten Runden:{' '}
                  {state.history
                    .slice(-5)
                    .map((h) => h.remaining)
                    .join(' → ')}
                </Text>
              </View>
            ) : null}
            <View style={card}>
              <Text accessibilityRole="header" style={heading}>
                2 · Deine Wiederholung
              </Text>
              <Text style={text}>
                {weakIds.length
                  ? `${weakIds.length} ${weakIds.length === 1 ? 'Lektion' : 'Lektionen'} zu deinen Wissenslücken · ${weakIds.length - pendingIds.length} wiederholt`
                  : state.history.length
                    ? 'Keine falschen Antworten offen. Ungeprüfte Fragen findest du in der nächsten Prüfung.'
                    : 'Nach der ersten Auswertung steht hier deine persönliche Wiederholung.'}
              </Text>
              {weakIds.length ? (
                <>
                  <Text style={muted}>
                    Vollständig neu angehörte Lektionen werden automatisch abgehakt. Lesen und
                    andere Lernwege kannst du selbst abhaken; das verändert noch kein
                    Prüfungsergebnis.
                  </Text>
                  <Text style={muted}>
                    Wie möchtest du wiederholen? Jeder Weg zählt gleich; keine Pflicht zum Lesen.
                  </Text>
                  {(
                    [
                      ['audio', 'Nur Audio'],
                      ['read', 'Nur Lesen'],
                      ['mixed', 'Audio und Lesen'],
                    ] as [Medium, string][]
                  ).map(([medium, label]) =>
                    button(
                      label,
                      () => {
                        void run(async () => {
                          await commit({ ...state, medium });
                        });
                      },
                      false,
                      false,
                      state.medium === medium,
                    ),
                  )}
                  {state.medium !== 'read' ? (
                    <>
                      {button(
                        pendingIds.length
                          ? `${pendingIds.length} ${pendingIds.length === 1 ? 'offene Lektion' : 'offene Lektionen'} am Stück hören`
                          : 'Wiederholung noch einmal hören',
                        () => {
                          void run(audio);
                        },
                        true,
                      )}
                      <Text style={muted}>
                        Startet die Wiederholung von vorn, ersetzt die aktuelle Warteschlange und
                        schaltet automatische Fortsetzung ein. Im Player pausieren/fortsetzen. Die
                        Liste findest du auch unter Hören → Playlists. Vorhandene Downloads werden
                        verwendet.
                      </Text>
                      {button(
                        downloads.running
                          ? 'Audio-Downloads laufen'
                          : 'Wiederholung offline herunterladen',
                        () => {
                          void batchDownloads.start(weakIds);
                        },
                        false,
                        downloads.running,
                      )}
                      {Object.keys(downloads.items).length ? (
                        <Text accessibilityLiveRegion="polite" style={muted}>
                          Downloads:{' '}
                          {
                            Object.values(downloads.items).filter(
                              (v) => v === 'downloaded' || v === 'skipped',
                            ).length
                          }{' '}
                          bereit ·{' '}
                          {Object.values(downloads.items).filter((v) => v === 'failed').length}{' '}
                          fehlgeschlagen. Verwaltung und Abbruch unter Hören.
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  {button(
                    details
                      ? 'Antwortdetails ausblenden'
                      : 'Falsche Antworten mit Erklärung anzeigen',
                    () => setDetails(!details),
                  )}
                </>
              ) : null}
            </View>
            {weakIds.slice(0, visibleCount).map((id) => {
              const lesson = lessons.find((l) => l.id === id);
              const wrong = stats.wrong.filter((q) => q.sourceLessonId === id);
              const reviewed = state.reviewed.includes(id) || heard[id]?.completed === true;
              return (
                <View key={id} style={card}>
                  <Text style={muted}>{lesson?.section ?? id}</Text>
                  <Text accessibilityRole="header" style={heading}>
                    {lesson?.title ?? id}
                  </Text>
                  <Text style={muted}>
                    {wrong.length} {wrong.length === 1 ? 'Frage' : 'Fragen'} zu festigen
                    {lesson ? ` · ca. ${lesson.durationMinutes} Min.` : ''}
                  </Text>
                  {state.medium !== 'audio'
                    ? button('Lektion lesen', () => router.push(`/lesson/${id}`))
                    : null}
                  {state.medium !== 'read'
                    ? button('Diese Lektion hören', () => {
                        void run(async () => {
                          await playLesson(id);
                          router.push('/player');
                        });
                      })
                    : null}
                  {button(
                    reviewed ? 'Wiederholt ✓ · rückgängig' : 'Als wiederholt abhaken',
                    () => {
                      void run(async () => {
                        if (reviewed) {
                          await clearReviewHearing(id);
                          setHeard((previous) => ({
                            ...previous,
                            [id]: { seconds: 0, duration: 0, completed: false },
                          }));
                        }
                        await commit({
                          ...state,
                          reviewed: reviewed
                            ? state.reviewed.filter((x) => x !== id)
                            : [...state.reviewed, id],
                        });
                      });
                    },
                    false,
                    false,
                    reviewed,
                  )}
                  {details
                    ? wrong.map((q) => (
                        <View
                          key={q.key}
                          style={{
                            gap: 8,
                            borderTopWidth: 1,
                            borderColor: theme.colors.border,
                            paddingTop: 12,
                          }}
                        >
                          <Text style={text}>{q.question}</Text>
                          <Text style={{ ...text, color: theme.colors.accent }}>
                            Richtig: {q.options.find((o) => o.isCorrect)?.text}
                          </Text>
                          <Text style={muted}>
                            {q.options.find((o) => o.isCorrect)?.explanation}
                          </Text>
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
            {weakIds.length > visibleCount
              ? button(`Weitere Lektionen anzeigen (${visibleCount} von ${weakIds.length})`, () =>
                  setVisibleCount(visibleCount + 12),
                )
              : null}
            {weakIds.length > 0 && !session
              ? button(
                  '3 · Offene Fragen erneut prüfen',
                  () => {
                    void run(() => start());
                  },
                  true,
                )
              : null}
          </>
        )}
        {busy ? (
          <ActivityIndicator
            accessibilityLabel="Speichern oder Audio vorbereiten"
            color={theme.colors.accent}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
