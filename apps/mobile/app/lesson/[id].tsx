import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, Check, ExternalLink, MessageSquarePlus } from 'lucide-react-native';
import type { Lesson, SpeechBlock } from '@futuredev/content-schema';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { ModuleCover } from '../../src/components/ModuleCover.js';
import { de } from '../../src/i18n/de.js';
import { useContent } from '../../src/content/ContentProvider.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { loadLesson } from '../../src/content/lessonLoader.js';
import { linkTermsInBlocks, type TextSegment } from '../../src/lesson/termLinking.js';
import { getProgress, markLessonState, saveReadPosition } from '../../src/data/progress.js';
import { listNotes, saveNote } from '../../src/data/notes.js';
import { listBookmarks, toggleBookmark } from '../../src/data/bookmarks.js';
import { getSetting, setSetting } from '../../src/data/settings.js';
import { isSameLessonInQueue, playLessonInModuleContext, togglePlayback } from '../../src/player/index.js';
import { useBottomChromeLayout } from '../../src/navigation/useBottomChromeInset.js';
import { lessonContentBottomPadding } from '../../src/navigation/lessonStickyChrome.js';
import { usePlayerStore } from '../../src/player/store.js';
import { currentItem } from '../../src/player/queue.js';
import { accumulateReadFocusTick, READ_FOCUS_TICK_SECONDS } from '../../src/settings/dailyLearning.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';

type SectionKey = 'body' | 'terms' | 'example' | 'task' | 'faq';
interface Section {
  key: SectionKey;
  title: string | null;
  data: unknown[];
}

// Vollstaendiger Lesen-Bildschirm (ersetzt die vorherige Ladeansicht von
// Agent A vollstaendig). SectionList statt FlatList/ScrollView: virtualisiert
// die teils 60+ Sprechbloecke einer 20-40-Minuten-Lektion (AW-045) UND
// unterstuetzt eine Sprungleiste ueber scrollToLocation (Begriffe,
// Praxisbeispiel, Praxisaufgabe, FAQ), ohne eine fremde Bibliothek.
function routeParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function LessonScreen() {
  const { id: rawId, block: rawBlock } = useLocalSearchParams<{ id: string | string[]; block?: string | string[] }>();
  const id = routeParam(rawId);
  const blockParam = routeParam(rawBlock);
  const theme = useTheme();
  const chromeLayout = useBottomChromeLayout();
  const { stickyBottomOffset } = chromeLayout;
  const firstFormPreference = useSettingsStore((s) => s.firstFormPreference);
  const setDailyLearningSecondsToday = useSettingsStore((s) => s.setDailyLearningSecondsToday);
  const { state: contentState } = useContent();
  const stickyBottomPadding = lessonContentBottomPadding(theme, chromeLayout);

  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined); // undefined = laedt noch
  const [readUntil, setReadUntil] = useState(0);
  const [bookmarkedPositions, setBookmarkedPositions] = useState<Set<number>>(new Set());
  const [noteDraftFor, setNoteDraftFor] = useState<number | null>(null);
  const [noteBodies, setNoteBodies] = useState<Record<number, string>>({});
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Set<number>>(new Set());
  const [audioError, setAudioError] = useState(false);
  const listRef = useRef<SectionList<unknown, Section>>(null);
  const hasMarkedRead = useRef(false);
  const pendingScrollRef = useRef<{ sectionIndex: number; itemIndex: number; attempts: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    (async () => {
      const fs = await getContentFs();
      const loaded = await loadLesson(fs, id);
      if (cancelled) return;
      setLesson(loaded);
      if (loaded) {
        const [progress, notes, bookmarks] = await Promise.all([getProgress(id), listNotes(id), listBookmarks(id)]);
        if (cancelled) return;
        setReadUntil(progress?.readUntil ?? 0);
        setNoteBodies(Object.fromEntries(notes.map((n) => [blockIndexFromNoteId(n.id), n.body])));
        setBookmarkedPositions(new Set(bookmarks.map((b) => b.position)));
        // Selbstpruefliste liegt bewusst in `settings`, nicht in `notes`: eine
        // Notiz waere in der Notizen-Liste (Reiter Ich) als unpassender
        // JSON-Eintrag aufgetaucht (siehe ux-bildschirmfluss.md Abschnitt 3:
        // "lokal gespeichert, kein Abgleich mit einer Musterloesung").
        const checklistRaw = await getSetting(`checklist:${id}`);
        if (checklistRaw) {
          try {
            setCheckedTasks(new Set(JSON.parse(checklistRaw) as number[]));
          } catch {
            // Beschaedigter Wert: leer starten statt abzustuerzen.
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      let appState: AppStateStatus = AppState.currentState;

      const tick = () => {
        if (appState !== 'active') return;
        void accumulateReadFocusTick().then((total) => {
          setDailyLearningSecondsToday(total);
        });
      };

      const start = () => {
        if (timer !== null) return;
        timer = setInterval(tick, READ_FOCUS_TICK_SECONDS * 1000);
      };

      const stop = () => {
        if (timer !== null) clearInterval(timer);
        timer = null;
      };

      const subscription = AppState.addEventListener('change', (next) => {
        appState = next;
        if (next === 'active') start();
        else stop();
      });

      if (appState === 'active') start();

      return () => {
        subscription.remove();
        stop();
      };
    }, [setDailyLearningSecondsToday]),
  );

  // "Im Text lesen" aus dem Player uebergibt den zuletzt gehoerten Block als
  // `block`-Parameter (app/player.tsx); hierher zurueckspringen heisst genau
  // dorthin scrollen, nicht nur die Lektion oeffnen.
  useEffect(() => {
    if (!lesson || blockParam === undefined) return;
    const blockIndex = Number(blockParam);
    if (!Number.isFinite(blockIndex) || blockIndex < 0 || blockIndex >= lesson.speechBlocks.length) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: blockIndex,
        viewPosition: 0,
        animated: true,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [lesson, blockParam]);

  const termSegments = useMemo<TextSegment[][]>(() => {
    if (!lesson) return [];
    return linkTermsInBlocks(lesson.speechBlocks, lesson.terms);
  }, [lesson]);

  const nextLessonId = useMemo(() => {
    if (!contentState.manifest) return null;
    const ids = contentState.manifest.lessons.map((l) => l.id).sort();
    const index = ids.indexOf(id ?? '');
    if (index === -1 || index + 1 >= ids.length) return null;
    return ids[index + 1] ?? null;
  }, [contentState.manifest, id]);

  if (lesson === undefined) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.lesson.loadingTitle} body={de.lesson.loadingBody} />
      </SafeAreaView>
    );
  }

  if (lesson === null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.lesson.notFoundTitle} body={de.lesson.notFoundBody} />
      </SafeAreaView>
    );
  }

  const sections: Section[] = [{ key: 'body', title: null, data: lesson.speechBlocks }];
  if (lesson.terms.length > 0) sections.push({ key: 'terms', title: de.lesson.termsHeading, data: [lesson.terms] });
  sections.push({ key: 'example', title: de.lesson.practiceExampleHeading, data: [lesson.practiceExample] });
  sections.push({ key: 'task', title: de.lesson.practiceTaskHeading, data: [lesson.practiceTask] });
  if (lesson.faq && lesson.faq.length > 0) {
    sections.push({ key: 'faq', title: de.lesson.faqHeading, data: [lesson.faq] });
  }

  function jumpTo(key: SectionKey) {
    const sectionIndex = sections.findIndex((s) => s.key === key);
    if (sectionIndex === -1) return;
    pendingScrollRef.current = { sectionIndex, itemIndex: 0, attempts: 0 };
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
  }

  function retryPendingScroll(info: { averageItemLength: number; index: number }) {
    const pending = pendingScrollRef.current;
    if (!pending || pending.attempts >= 4) {
      pendingScrollRef.current = null;
      return;
    }
    pending.attempts += 1;
    listRef.current?.getScrollResponder()?.scrollTo({
      y: Math.max(0, info.averageItemLength * info.index),
      animated: false,
    });
    setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex: pending.sectionIndex,
        itemIndex: pending.itemIndex,
        viewPosition: 0,
        animated: true,
      });
    }, 50);
  }

  async function openGlossary(term: string) {
    setGlossaryTerm(term);
  }

  async function handleBookmark(position: number) {
    if (!id) return;
    const wasBookmarked = bookmarkedPositions.has(position);
    setBookmarkedPositions((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(position);
      else next.add(position);
      return next;
    });
    try {
      const nowBookmarked = await toggleBookmark(id, position);
      setBookmarkedPositions((prev) => {
        const next = new Set(prev);
        if (nowBookmarked) next.add(position);
        else next.delete(position);
        return next;
      });
    } catch (err) {
      setBookmarkedPositions((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(position);
        else next.delete(position);
        return next;
      });
      const devDetail = __DEV__ && err instanceof Error ? `\n${err.message}` : '';
      Alert.alert(de.lesson.bookmarkLabel, `${de.lesson.bookmarkError}${devDetail}`);
    }
  }

  async function handleSaveNote(position: number) {
    if (!id) return;
    const body = noteBodies[position] ?? '';
    await saveNote(`${id}-block-${position}`, id, body);
    setNoteDraftFor(null);
  }

  async function handleToggleTask(index: number) {
    const next = new Set(checkedTasks);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setCheckedTasks(next);
    await setSetting(`checklist:${id}`, JSON.stringify([...next]));
  }

  async function handleViewableChanged({ viewableItems }: { viewableItems: ViewToken[] }) {
    if (!lesson || !id) return;
    const bodyItems = viewableItems.filter((v) => v.section?.key === 'body');
    if (bodyItems.length === 0) return;
    const lastVisibleIndex = Math.max(...bodyItems.map((v) => v.index ?? 0));
    setReadUntil(lastVisibleIndex);
    await saveReadPosition(id, lastVisibleIndex);
    const isLastBlock = lastVisibleIndex >= lesson.speechBlocks.length - 1;
    if (isLastBlock && !hasMarkedRead.current) {
      hasMarkedRead.current = true;
      await markLessonState(id, 'read');
    }
  }

  const openRepo = () => {
    if (!lesson) return;
    const repoName = lesson.practiceExample.repoNote.replace(/^repo-/, '');
    void Linking.openURL(`https://github.com/DomenicMoran/${repoName}`);
  };

  // Deckt den Zustand "Fehler" aus ux-bildschirmfluss.md Abschnitt 2 (Hören)
  // ab: ein fehlender oder beschaedigter Kapitelmarken-Datensatz (offline,
  // kaputtes Manifest) darf nicht als unbehandelte Promise-Ablehnung im
  // RedBox/Toast enden, sondern zeigt de.player.loadError mit Wiederholen-
  // Knopf, ohne den Lesebildschirm zu blockieren.
  const handleListen = () => {
    if (!id) return;
    setAudioError(false);
    if (isSameLessonInQueue(id)) {
      const playing = usePlayerStore.getState().isPlaying;
      if (playing) {
        router.push('/player');
        return;
      }
      void togglePlayback()
        .then(() => router.push('/player'))
        .catch(() => setAudioError(true));
      return;
    }
    playLessonInModuleContext(id, readUntil).catch(() => {
      setAudioError(true);
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <SectionList
        ref={listRef}
        sections={sections}
        contentContainerStyle={{ paddingBottom: stickyBottomPadding }}
        keyExtractor={(item, index) => `${(item as { text?: string })?.text ?? index}-${index}`}
        stickySectionHeadersEnabled={false}
        onViewableItemsChanged={(info) => void handleViewableChanged(info)}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollToIndexFailed={(info) => retryPendingScroll(info)}
        onMomentumScrollEnd={() => {
          pendingScrollRef.current = null;
        }}
        ListHeaderComponent={
          <LessonHeader
            lesson={lesson}
            sections={sections}
            onJump={jumpTo}
            audioError={audioError}
            onRetryListen={handleListen}
          />
        }
        ListFooterComponent={
          nextLessonId ? (
            <View style={{ padding: theme.spacing.base }}>
              <Pressable
                onPress={() => router.replace(`/lesson/${nextLessonId}`)}
                accessibilityRole="button"
                accessibilityLabel={de.lesson.nextLesson}
                style={[styles.secondaryButton, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
              >
                <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>{de.lesson.nextLesson}</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text style={[styles.sectionHeading, { color: theme.colors.text, backgroundColor: theme.colors.bg }]}>
              {section.title}
            </Text>
          ) : null
        }
        renderItem={({ item, index, section }) => {
          if (section.key === 'body') {
            const block = item as SpeechBlock;
            // role "faq" steht schon im eigenen Abschnitt (aus lesson.faq);
            // im Fliesstext wird der Block uebersprungen, um ihn nicht
            // doppelt zu zeigen. Der Index bleibt unveraendert (Positionen
            // fuer Notizen, Lesezeichen und den Player zaehlen weiter über
            // lesson.speechBlocks), nur die Darstellung entfaellt.
            if (block.role === 'faq') return null;
            return (
              <SpeechBlockRow
                block={block}
                segments={termSegments[index] ?? [{ text: block.text, term: null }]}
                isBookmarked={bookmarkedPositions.has(index)}
                noteBody={noteBodies[index]}
                isDraftOpen={noteDraftFor === index}
                onTapTerm={openGlossary}
                onToggleBookmark={() => void handleBookmark(index)}
                onOpenNoteDraft={() => setNoteDraftFor(index)}
                onChangeNote={(text) => setNoteBodies((prev) => ({ ...prev, [index]: text }))}
                onSaveNote={() => void handleSaveNote(index)}
              />
            );
          }
          if (section.key === 'terms') {
            return (
              <View style={styles.termChips}>
                {lesson.terms.map((t) => (
                  <Pressable
                    key={t.term}
                    onPress={() => void openGlossary(t.term)}
                    accessibilityRole="button"
                    accessibilityLabel={t.term}
                    style={[styles.termChip, { borderColor: theme.colors.accent, minHeight: 44 }]}
                  >
                    <Text style={{ color: theme.colors.accent, fontSize: 14, lineHeight: 20 }}>{t.term}</Text>
                  </Pressable>
                ))}
              </View>
            );
          }
          if (section.key === 'example') {
            return (
              <View style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
                <Text style={[styles.bodyText, { color: theme.colors.text }]}>{lesson.practiceExample.text}</Text>
                <Text style={[styles.metaText, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                  {lesson.practiceExample.location}
                </Text>
                <Pressable
                  onPress={openRepo}
                  accessibilityRole="button"
                  accessibilityLabel={de.lesson.practiceExampleOpenRepo}
                  style={[
                    styles.secondaryButton,
                    { borderColor: theme.colors.border, minHeight: theme.minTapTarget, marginTop: theme.spacing.sm, flexDirection: 'row', gap: 8 },
                  ]}
                >
                  <ExternalLink size={18} color={theme.colors.text} />
                  <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>
                    {de.lesson.practiceExampleOpenRepo}
                  </Text>
                </Pressable>
              </View>
            );
          }
          if (section.key === 'task') {
            return (
              <View style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
                <Text style={[styles.bodyText, { color: theme.colors.text }]}>{lesson.practiceTask.task}</Text>
                <Text style={[styles.metaText, { color: theme.colors.textWeak, marginTop: theme.spacing.sm, fontWeight: '600' }]}>
                  {de.lesson.practiceTaskExpectation}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.textWeak }]}>{lesson.practiceTask.expectation}</Text>
                {lesson.practiceTask.checklist.map((entry, i) => (
                  <Pressable
                    key={entry}
                    onPress={() => void handleToggleTask(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checkedTasks.has(i) }}
                    accessibilityLabel={entry}
                    style={[styles.checklistRow, { minHeight: 44 }]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: theme.colors.accent,
                          backgroundColor: checkedTasks.has(i) ? theme.colors.accent : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      {checkedTasks.has(i) ? <Check color={theme.colors.accentText} size={14} strokeWidth={3} /> : null}
                    </View>
                    <Text style={[styles.bodyText, { color: theme.colors.text, flex: 1 }]}>{entry}</Text>
                  </Pressable>
                ))}
              </View>
            );
          }
          // faq
          return (
            <View style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
              {(lesson.faq ?? []).map((entry) => (
                <View key={entry.question} style={{ marginBottom: theme.spacing.md }}>
                  <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{entry.question}</Text>
                  <Text style={[styles.bodyText, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                    {entry.answer}
                  </Text>
                </View>
              ))}
            </View>
          );
        }}
      />

      <GlossaryModal
        lesson={lesson}
        term={glossaryTerm}
        onClose={() => setGlossaryTerm(null)}
      />

      {lesson && id ? (
        <LessonStickyActions
          listenFirst={firstFormPreference === 'listen'}
          stickyBottomOffset={stickyBottomOffset}
          lessonId={id}
          onListen={handleListen}
          onQuiz={() => router.push(`/quiz/${id}`)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LessonStickyActions({
  listenFirst,
  stickyBottomOffset,
  lessonId,
  onListen,
  onQuiz,
}: {
  listenFirst: boolean;
  /** Aus useBottomChromeLayout: direkt über Mini-Player/Reiter, ohne Scroll-Doppel-Safe-Area. */
  stickyBottomOffset: number;
  lessonId: string;
  onListen: () => void;
  onQuiz: () => void;
}) {
  const theme = useTheme();
  const queue = usePlayerStore((s) => s.queue);
  const playingThisLesson = currentItem(queue)?.lessonId === lessonId;
  const listenButton = (
    <PressableFeedback
      key="listen"
      onPress={onListen}
      accessibilityRole="button"
      accessibilityLabel={de.lesson.listenTab}
      style={[
        styles.stickyButton,
        styles.calmAccentAction,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderLeftColor: theme.colors.accent,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
          flex: 1,
        },
      ]}
    >
      <Text style={[styles.primaryButtonLabel, { color: theme.colors.text, fontWeight: '600' }]}>{de.lesson.listenTab}</Text>
    </PressableFeedback>
  );
  const quizButton = (
    <PressableFeedback
      key="quiz"
      onPress={onQuiz}
      accessibilityRole="button"
      accessibilityLabel={de.lesson.quizStart}
      style={[
        styles.stickyButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
          flex: 1,
        },
      ]}
    >
      <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text, fontWeight: '600' }]}>{de.lesson.quizStart}</Text>
    </PressableFeedback>
  );

  const actions =
    playingThisLesson ? [quizButton] : listenFirst ? [listenButton, quizButton] : [quizButton, listenButton];

  return (
    <View
      style={[
        styles.stickyBar,
        {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          bottom: stickyBottomOffset,
          paddingBottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.base,
          paddingTop: theme.spacing.sm,
          zIndex: 15,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>{actions}</View>
    </View>
  );
}

function blockIndexFromNoteId(noteId: string): number {
  const match = /-block-(\d+)$/.exec(noteId);
  return match ? Number(match[1]) : -1;
}

function LessonHeader({
  lesson,
  sections,
  onJump,
  audioError,
  onRetryListen,
}: {
  lesson: Lesson;
  sections: Section[];
  onJump: (key: SectionKey) => void;
  audioError: boolean;
  onRetryListen: () => void;
}) {
  const theme = useTheme();
  const allJumpTargets: { key: SectionKey; label: string }[] = [
    { key: 'terms', label: de.lesson.jumpTerms },
    { key: 'example', label: de.lesson.jumpExample },
    { key: 'task', label: de.lesson.jumpTask },
    { key: 'faq', label: de.lesson.jumpFaq },
  ];
  const jumpTargets = allJumpTargets.filter((t) => sections.some((s) => s.key === t.key));

  const moduleId = lesson.id.split('-')[0] ?? '';

  return (
    <View style={{ padding: theme.spacing.base }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={de.lesson.back}
        style={({ pressed }) => [
          styles.backRow,
          { minHeight: theme.minTapTarget, marginBottom: theme.spacing.sm, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <ArrowLeft size={22} color={theme.colors.text} strokeWidth={1.75} />
        <Text style={[styles.backLabel, { color: theme.colors.text }]}>{de.lesson.back}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {moduleId ? <ModuleCover moduleId={moduleId} size={40} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.lessonTitle, { color: theme.colors.text }]}>{lesson.title}</Text>
        </View>
      </View>
      <Text style={[styles.metaText, { color: theme.colors.textWeak }]}>
        {de.module.lessonDuration(lesson.durationMinutes)}
      </Text>

      {audioError ? (
        <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.sm }}>
          <Text accessibilityRole="alert" style={[styles.metaText, { color: theme.colors.error }]}>
            {de.player.loadError}
          </Text>
          <Pressable
            onPress={onRetryListen}
            accessibilityRole="button"
            accessibilityLabel={de.player.retryPlayback}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: theme.colors.error,
                backgroundColor: theme.colors.surface,
                minHeight: theme.minTapTarget,
                minWidth: 160,
                paddingHorizontal: theme.spacing.base,
                alignSelf: 'flex-start',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: theme.colors.error, fontWeight: '600' }]}>
              {de.player.retryPlayback}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {jumpTargets.length > 0 ? (
        <View style={[styles.jumpRow, { marginTop: theme.spacing.sm }]}>
          {jumpTargets.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => onJump(t.key)}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              style={[styles.jumpChip, { borderColor: theme.colors.border, minHeight: 36 }]}
            >
              <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SpeechBlockRow({
  block,
  segments,
  isBookmarked,
  noteBody,
  isDraftOpen,
  onTapTerm,
  onToggleBookmark,
  onOpenNoteDraft,
  onChangeNote,
  onSaveNote,
}: {
  block: SpeechBlock;
  segments: TextSegment[];
  isBookmarked: boolean;
  noteBody: string | undefined;
  isDraftOpen: boolean;
  onTapTerm: (term: string) => void;
  onToggleBookmark: () => void;
  onOpenNoteDraft: () => void;
  onChangeNote: (text: string) => void;
  onSaveNote: () => void;
}) {
  const theme = useTheme();
  const speakerLabel = block.speaker === 'A' ? de.lesson.speakerA : de.lesson.speakerB;

  return (
    <View
      style={[
        styles.blockRow,
        {
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          borderLeftWidth: block.isKeySentence ? 3 : 0,
          borderLeftColor: theme.colors.accent,
        },
      ]}
    >
      <View style={styles.blockHeaderRow}>
        <Text style={[styles.speakerLabel, { color: theme.colors.textWeak }]}>{speakerLabel}</Text>
        <View style={styles.blockActions} pointerEvents="box-none">
          <Pressable
            onPress={onToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? de.lesson.bookmarkRemove : de.lesson.bookmarkSet}
            hitSlop={12}
            style={[styles.iconButton, { zIndex: 2 }]}
          >
            {isBookmarked ? (
              <BookmarkCheck size={18} color={theme.colors.accent} />
            ) : (
              <Bookmark size={18} color={theme.colors.textWeak} />
            )}
          </Pressable>
          <Pressable
            onPress={onOpenNoteDraft}
            accessibilityRole="button"
            accessibilityLabel={de.lesson.noteAdd}
            hitSlop={8}
            style={styles.iconButton}
          >
            <MessageSquarePlus size={18} color={noteBody ? theme.colors.accent : theme.colors.textWeak} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.bodyText, { color: theme.colors.text }]}>
        {segments.map((segment, i) =>
          segment.term ? (
            <Text
              key={i}
              onPress={() => onTapTerm(segment.term as string)}
              style={{ color: theme.colors.accent, textDecorationLine: 'underline' }}
              accessibilityRole="link"
              accessibilityLabel={segment.term}
            >
              {segment.text}
            </Text>
          ) : (
            <Text key={i}>{segment.text}</Text>
          ),
        )}
      </Text>

      {noteBody && !isDraftOpen ? (
        <Text style={[styles.noteText, { color: theme.colors.textWeak }]}>{de.lesson.noteLabel}: {noteBody}</Text>
      ) : null}

      {isDraftOpen ? (
        <View style={{ marginTop: theme.spacing.xs }}>
          <TextInput
            value={noteBody ?? ''}
            onChangeText={onChangeNote}
            placeholder={de.lesson.notePlaceholder}
            placeholderTextColor={theme.colors.textWeak}
            multiline
            accessibilityLabel={de.lesson.noteLabel}
            style={[
              styles.noteInput,
              { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface },
            ]}
          />
          <Pressable
            onPress={onSaveNote}
            accessibilityRole="button"
            accessibilityLabel={de.lesson.noteSave}
            style={[styles.secondaryButton, { borderColor: theme.colors.border, minHeight: 36, marginTop: theme.spacing.xs }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>{de.lesson.noteSave}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function GlossaryModal({ lesson, term, onClose }: { lesson: Lesson; term: string | null; onClose: () => void }) {
  const theme = useTheme();
  const entry = lesson.terms.find((t) => t.term === term);

  return (
    <Modal visible={term !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} accessibilityLabel={de.lesson.glossaryClose}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.lessonTitle, { color: theme.colors.text, fontSize: 18 }]}>{entry?.term}</Text>
          <Text style={[styles.bodyText, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
            {entry?.definition}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={de.lesson.glossaryClose}
            style={[styles.secondaryButton, { borderColor: theme.colors.border, minHeight: 44, marginTop: theme.spacing.base }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: theme.colors.text }]}>{de.lesson.glossaryClose}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  lessonId: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.5 },
  lessonTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', marginTop: 2 },
  metaText: { fontSize: 13, lineHeight: 18 },
  listenButton: { borderWidth: 0 },
  jumpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jumpChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, justifyContent: 'center' },
  sectionHeading: { fontSize: 15, lineHeight: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  blockRow: {},
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  speakerLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  blockActions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 6 },
  bodyText: { fontSize: 16, lineHeight: 26, maxWidth: 560 },
  noteText: { fontSize: 13, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  termChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  termChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center' },
  primaryButton: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonLabel: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonLabel: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2 },
  faqQuestion: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stickyButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  calmAccentAction: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
});
