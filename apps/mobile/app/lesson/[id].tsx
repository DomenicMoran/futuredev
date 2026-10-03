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
import { getProgress, markLessonRead, saveReadPosition } from '../../src/data/progress.js';
import { listNotes, saveNote } from '../../src/data/notes.js';
import { listBookmarks, toggleBookmark } from '../../src/data/bookmarks.js';
import { getSetting, setSetting } from '../../src/data/settings.js';
import { isSameLessonInQueue, playLessonInModuleContext, togglePlayback } from '../../src/player/index.js';
import { useBottomChromeLayout } from '../../src/navigation/useBottomChromeInset.js';
import { lessonContentBottomPadding } from '../../src/navigation/lessonStickyChrome.js';
import { anchoredSectionRows, isLessonJumpTargetVisible, lessonJumpTargetKey, measureLessonJumpTargetAlignment, persistReadCompletion, visibleSpeechBlockTarget, type MeasurableJumpView } from '../../src/navigation/lessonReadingState.js';
import { usePlayerStore } from '../../src/player/store.js';
import { currentItem } from '../../src/player/queue.js';
import { accumulateReadFocusTick, READ_FOCUS_TICK_SECONDS } from '../../src/settings/dailyLearning.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';

type SectionKey = 'body' | 'terms' | 'example' | 'task' | 'faq' | 'completion';
interface Section {
  key: SectionKey;
  title: string | null;
  data: unknown[];
}
interface PendingScroll {
  sectionKey: SectionKey;
  itemIndex: number;
  attempts: number;
}

const LESSON_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10, minimumViewTime: 120 };

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
  const stickyBottomPadding = lessonContentBottomPadding(theme);

  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined); // undefined = laedt noch
  const [readUntil, setReadUntil] = useState(0);
  const [bookmarkedPositions, setBookmarkedPositions] = useState<Set<number>>(new Set());
  const [noteDraftFor, setNoteDraftFor] = useState<number | null>(null);
  const [noteBodies, setNoteBodies] = useState<Record<number, string>>({});
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Set<number>>(new Set());
  const [audioError, setAudioError] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const listRef = useRef<SectionList<unknown, Section>>(null);
  const completionStateRef = useRef({ done: false, inFlight: false });
  const latestLessonRef = useRef(lesson);
  latestLessonRef.current = lesson;
  const currentLessonIdRef = useRef(id);
  currentLessonIdRef.current = id;
  const pendingScrollRef = useRef<PendingScroll | null>(null);
  const failedScrollRef = useRef<PendingScroll | null>(null);
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listViewportRef = useRef<MeasurableJumpView | null>(null);
  const jumpAnchorRefs = useRef(new Map<string, View>());
  const jumpMeasurementInFlightRef = useRef<string | null>(null);
  const pendingTargetViewableRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const [scrollError, setScrollError] = useState(false);
  const viewabilityHandlerRef = useRef<(info: { viewableItems: ViewToken[] }) => void>(() => undefined);
  const stableViewabilityHandler = useRef((info: { viewableItems: ViewToken[] }) => viewabilityHandlerRef.current(info)).current;
  const sections = useMemo<Section[]>(() => {
    if (!lesson) return [];
    const result: Section[] = [{ key: 'body', title: null, data: lesson.speechBlocks }];
    if (lesson.terms.length > 0) result.push({
      key: 'terms', title: null, data: anchoredSectionRows(de.lesson.termsHeading, lesson.terms),
    });
    result.push({ key: 'example', title: null, data: anchoredSectionRows(de.lesson.practiceExampleHeading, [lesson.practiceExample]) });
    result.push({ key: 'task', title: null, data: anchoredSectionRows(de.lesson.practiceTaskHeading, [lesson.practiceTask]) });
    if (lesson.faq && lesson.faq.length > 0) {
      result.push({ key: 'faq', title: null, data: anchoredSectionRows(de.lesson.faqHeading, lesson.faq) });
    }
    result.push({ key: 'completion', title: null, data: [{ kind: 'lesson-completion-action' }] });
    return result;
  }, [lesson]);
  const beginScrollRef = useRef<(sectionKey: SectionKey, itemIndex: number) => PendingScroll>(() => ({ sectionKey: 'body', itemIndex: 0, attempts: 0 }));

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLesson(undefined);
    completionStateRef.current = { done: false, inFlight: false };
    setCompletionStatus('idle');
    pendingScrollRef.current = null;
    failedScrollRef.current = null;
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    setScrollError(false);
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

  useEffect(() => () => {
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
  }, []);

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
    if (!lesson || lesson.id !== id || blockParam === undefined) return;
    const blockIndex = Number(blockParam);
    if (!Number.isFinite(blockIndex) || blockIndex < 0 || blockIndex >= lesson.speechBlocks.length) return;
    const timer = setTimeout(() => {
      const target = visibleSpeechBlockTarget(blockIndex, lesson.speechBlocks, lesson.faq ?? []);
      beginScrollRef.current(target.sectionKey, target.itemIndex);
      setScrollError(false);
      const sectionIndex = sections.findIndex((section) => section.key === target.sectionKey);
      if (sectionIndex < 0) return;
      listRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: target.itemIndex,
        viewPosition: 0,
        animated: true,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [lesson, blockParam, sections, id]);

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
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.lesson.loadingTitle} body={de.lesson.loadingBody} />
      </SafeAreaView>
    );
  }

  if (lesson === null) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.lesson.notFoundTitle} body={de.lesson.notFoundBody} actionLabel="Zur Lernübersicht" onAction={() => router.replace('/(tabs)/lernen')} />
      </SafeAreaView>
    );
  }

  if (lesson.id !== id) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg}]}>
        <EmptyState Icon={BookOpen} title={de.lesson.loadingTitle} body={de.lesson.loadingBody} />
      </SafeAreaView>
    );
  }
  function jumpTo(key: SectionKey) {
    const sectionIndex = sections.findIndex((s) => s.key === key);
    if (sectionIndex === -1) return;
    const pending = beginScroll(key, 0);
    scrollToPendingTarget(pending, true);
  }

  function beginScroll(sectionKey: SectionKey, itemIndex: number): PendingScroll {
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    const pending = { sectionKey, itemIndex, attempts: 0 };
    pendingScrollRef.current = pending;
    failedScrollRef.current = null;
    pendingTargetViewableRef.current = false;
    jumpMeasurementInFlightRef.current = null;
    setScrollError(false);
    scheduleScrollRetry(pending);
    return pending;
  }
  beginScrollRef.current = beginScroll;

  function scheduleScrollRetry(pending: PendingScroll) {
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    scrollRetryTimerRef.current = setTimeout(() => {
      if (pendingScrollRef.current !== pending) return;
      if (pending.attempts >= 24) {
        failedScrollRef.current = pending;
        pendingScrollRef.current = null;
        setScrollError(true);
        return;
      }
      pending.attempts += 1;
      if (sections.findIndex((section) => section.key === pending.sectionKey) < 0) {
        failedScrollRef.current = pending;
        pendingScrollRef.current = null;
        setScrollError(true);
        return;
      }
      if (pendingTargetViewableRef.current) {
        measurePendingTargetAlignment(pending);
      } else {
        scrollToPendingTarget(pending, false);
      }
      scheduleScrollRetry(pending);
    }, pending.attempts === 0 ? 650 : 450);
  }

  function scrollToPendingTarget(pending: PendingScroll, animated: boolean) {
    const sectionIndex = sections.findIndex((section) => section.key === pending.sectionKey);
    if (sectionIndex < 0) return;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: pending.itemIndex, viewPosition: 0, animated });
    setTimeout(() => measurePendingTargetAlignment(pending), 100);
  }

  function applyJumpScrollCorrection(pending: PendingScroll, scrollDelta: number) {
    if (pendingScrollRef.current !== pending) return;
    const nextOffset = Math.max(0, scrollOffsetRef.current + scrollDelta);
    scrollOffsetRef.current = nextOffset;
    listRef.current?.getScrollResponder()?.scrollTo({ y: nextOffset, animated: false });
    setTimeout(() => measurePendingTargetAlignment(pending), 50);
  }

  function measurePendingTargetAlignment(pending: PendingScroll) {
    measureLessonJumpTargetAlignment(
      pending,
      () => pendingScrollRef.current,
      jumpMeasurementInFlightRef,
      jumpAnchorRefs.current,
      listViewportRef.current,
      settlePendingScroll,
      (scrollDelta) => applyJumpScrollCorrection(pending, scrollDelta),
    );
  }

  function registerJumpAnchor(sectionKey: SectionKey, itemIndex: number, node: View | null) {
    const key = lessonJumpTargetKey({ sectionKey, itemIndex });
    if (node) jumpAnchorRefs.current.set(key, node);
    else jumpAnchorRefs.current.delete(key);
  }

  function onJumpAnchorLayout(sectionKey: SectionKey, itemIndex: number) {
    const pending = pendingScrollRef.current;
    if (pending?.sectionKey === sectionKey && pending.itemIndex === itemIndex) {
      setTimeout(() => measurePendingTargetAlignment(pending), 50);
    }
  }

  function retryPendingScroll(info: { averageItemLength: number; index: number }) {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    // The estimate only moves the virtualized window near the target. It is
    // never treated as success: the request remains pending until its actual
    // section/item appears in viewability callbacks.
    if (info) {
      listRef.current?.getScrollResponder()?.scrollTo({
        y: Math.max(0, info.averageItemLength * info.index),
        animated: false,
      });
    }
    scheduleScrollRetry(pending);
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

  viewabilityHandlerRef.current = ({ viewableItems }) => {
    const visibleItems = viewableItems.flatMap((token) =>
      token.section?.key && token.index !== null && token.index !== undefined
        ? [{ sectionKey: String(token.section.key), itemIndex: token.index, isViewable: token.isViewable === true }]
        : [],
    );
    const pending = pendingScrollRef.current;
    const pendingVisible = pending
      ? isLessonJumpTargetVisible(visibleItems, { sectionKey: pending.sectionKey, itemIndex: pending.itemIndex })
      : false;
    pendingTargetViewableRef.current = pendingVisible;
    if (pending && pendingVisible) {
      measurePendingTargetAlignment(pending);
    }
    const currentId = currentLessonIdRef.current;
    if (!latestLessonRef.current || latestLessonRef.current.id !== currentId || !currentId) return;
    const bodyItems = viewableItems.filter((v) => v.section?.key === 'body');
    if (bodyItems.length === 0) return;
    const lastVisibleIndex = Math.max(...bodyItems.map((v) => v.index ?? 0));
    setReadUntil(lastVisibleIndex);
    void saveReadPosition(currentId, lastVisibleIndex).catch(() => undefined);
  };

  function settlePendingScroll() {
    pendingScrollRef.current = null;
    pendingTargetViewableRef.current = false;
    jumpMeasurementInFlightRef.current = null;
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    scrollRetryTimerRef.current = null;
    setScrollError(false);
  }

  function cancelPendingScrollForManualScroll() {
    // Once a learner takes control, retries must not yank the list back and a
    // stale failure affordance must not remain after they reach the section.
    pendingScrollRef.current = null;
    failedScrollRef.current = null;
    pendingTargetViewableRef.current = false;
    jumpMeasurementInFlightRef.current = null;
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    scrollRetryTimerRef.current = null;
    setScrollError(false);
  }

  async function handleCompleteReading() {
    const targetId = id;
    if (!targetId) return;
    setCompletionStatus('saving');
    const status = await persistReadCompletion(completionStateRef.current, () => markLessonRead(targetId).then(() => undefined));
    if (currentLessonIdRef.current !== targetId) return;
    setCompletionStatus(status === 'saved' || status === 'already-saved' ? 'saved' : status === 'failed' ? 'error' : 'saving');
  }

  function retryFailedScroll() {
    const failed = failedScrollRef.current;
    if (!failed) return;
    const sectionIndex = sections.findIndex((section) => section.key === failed.sectionKey);
    if (sectionIndex < 0) return;
    const pending = beginScroll(failed.sectionKey, failed.itemIndex);
    scrollToPendingTarget(pending, true);
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
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
            <View
        collapsable={false}
        style={{ flex: 1 }}
        ref={(node) => {
          listViewportRef.current = node;
        }}
      >
      <SectionList
        ref={(node) => {
          listRef.current = node;
        }}
        sections={sections}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: stickyBottomPadding }}
        keyExtractor={(item, index) => {
          const row = item as { text?: string; term?: string; question?: string; title?: string; kind?: string };
          return `${row?.text ?? row?.term ?? row?.question ?? row?.title ?? row?.kind ?? 'row'}-${index}`;
        }}
        stickySectionHeadersEnabled={false}
        // SectionList converts flattened ViewTokens to {section,index} only
        // through this callback. `viewabilityConfigCallbackPairs` passes the
        // unconverted VirtualizedList tokens and never supplied `section`.
        viewabilityConfig={LESSON_VIEWABILITY_CONFIG}
        onViewableItemsChanged={stableViewabilityHandler}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          const pending = pendingScrollRef.current;
          if (pending) measurePendingTargetAlignment(pending);
        }}
        scrollEventThrottle={16}
        onScrollToIndexFailed={(info) => retryPendingScroll(info)}
        onScrollBeginDrag={cancelPendingScrollForManualScroll}
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
        renderSectionHeader={() => null}
        renderItem={({ item, index, section }) => {
          if ((item as { kind?: string })?.kind === 'lesson-section-anchor') {
            return (
              <View
                collapsable={false}
                ref={(node) => registerJumpAnchor(section.key, index, node)}
                onLayout={() => onJumpAnchorLayout(section.key, index)}
              >
                <Text style={[styles.sectionHeading, { color: theme.colors.text, backgroundColor: theme.colors.bg }]}>
                  {(item as { title: string }).title}
                </Text>
              </View>
            );
          }
          if (section.key === 'body') {
            const block = item as SpeechBlock;
            // role "faq" steht schon im eigenen Abschnitt (aus lesson.faq);
            // im Fliesstext wird der Block uebersprungen, um ihn nicht
            // doppelt zu zeigen. Der Index bleibt unveraendert (Positionen
            // fuer Notizen, Lesezeichen und den Player zaehlen weiter über
            // lesson.speechBlocks), nur die Darstellung entfaellt.
            if (block.role === 'faq') return null;
            if (!block.text.trim()) return null;
            return (
              <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)}>
                <SpeechBlockRow
                  block={block}
                  showSpeaker={index === 0 || lesson.speechBlocks[index - 1]?.speaker !== block.speaker}
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
              </View>
            );
          }
          if (section.key === 'terms') {
            return (
              <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)} style={{ paddingHorizontal: theme.spacing.base, paddingBottom: 4 }}>
                <Pressable
                  onPress={() => void openGlossary((item as { term: string }).term)}
                  accessibilityRole="button"
                  accessibilityLabel={(item as { term: string }).term}
                  style={[styles.termChip, { borderColor: theme.colors.accent, minHeight: 48, alignSelf: 'flex-start' }]}
                >
                  <Text style={{ color: theme.colors.accent, fontSize: 14, lineHeight: 20 }}>{(item as { term: string }).term}</Text>
                </Pressable>
              </View>
            );
          }
          if (section.key === 'example') {
            return (
              <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)} style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
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
              <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)} style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
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
                    style={[styles.checklistRow, { minHeight: 48 }]}
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
          if (section.key === 'completion') {
            const isComplete = completionStatus === 'saved';
            return (
              <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)} style={{ padding: theme.spacing.base, alignItems: 'stretch' }}>
                <Pressable
                  onPress={() => void handleCompleteReading()}
                  disabled={completionStatus === 'saving' || isComplete}
                  accessibilityRole="button"
                  accessibilityLabel={isComplete ? 'Lektion als gelesen markiert' : 'Lektion als gelesen markieren'}
                  accessibilityState={{ disabled: completionStatus === 'saving' || isComplete }}
                  style={[styles.secondaryButton, { borderColor: completionStatus === 'error' ? theme.colors.error : theme.colors.border, minHeight: theme.minTapTarget }]}
                >
                  <Text style={[styles.secondaryButtonLabel, { color: completionStatus === 'error' ? theme.colors.error : theme.colors.text }]}>
                    {completionStatus === 'saving' ? 'Speichert …' : isComplete ? 'Als gelesen markiert' : 'Lektion als gelesen markieren'}
                  </Text>
                </Pressable>
                {completionStatus === 'error' ? (
                  <Text accessibilityRole="alert" style={[styles.metaText, { color: theme.colors.error, marginTop: theme.spacing.xs }]}>
                    Speichern fehlgeschlagen. Tippe zum erneuten Versuch.
                  </Text>
                ) : null}
              </View>
            );
          }
          return (
            <View collapsable={false} ref={(node) => registerJumpAnchor(section.key, index, node)} onLayout={() => onJumpAnchorLayout(section.key, index)} style={{ paddingHorizontal: theme.spacing.base, paddingBottom: theme.spacing.base }}>
              <View style={{ marginBottom: theme.spacing.md }}>
                <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{(item as { question: string }).question}</Text>
                <Text style={[styles.bodyText, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                  {(item as { answer: string }).answer}
                </Text>
              </View>
            </View>
          );
        }}
      />
      </View>

      {scrollError ? (
        <Pressable onPress={retryFailedScroll} accessibilityRole="button" style={{ paddingHorizontal: theme.spacing.base, minHeight: theme.minTapTarget, justifyContent: 'center' }}>
          <Text accessibilityRole="alert" style={[styles.metaText, { color: theme.colors.error }]}>Abschnitt nicht erreicht. Erneut versuchen.</Text>
        </Pressable>
      ) : null}

      <GlossaryModal
        lesson={lesson}
        term={glossaryTerm}
        onClose={() => setGlossaryTerm(null)}
      />

      {lesson && id ? (
        <LessonStickyActions
          listenFirst={firstFormPreference === 'listen'}
          lessonId={id}
          onListen={handleListen}
          onQuiz={() => router.push(`/quiz/${id}`)}
        />
      ) : null}
      <View style={{ height: stickyBottomOffset }} />
    </SafeAreaView>
  );
}

function LessonStickyActions({
  listenFirst,
  lessonId,
  onListen,
  onQuiz,
}: {
  listenFirst: boolean;
  lessonId: string;
  onListen: () => void;
  onQuiz: () => void;
}) {
  const theme = useTheme();
  const queue = usePlayerStore((s) => s.queue);
  const playingThisLesson = currentItem(queue)?.lessonId === lessonId;
  const stickyActionStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.md,
    minHeight: theme.minTapTarget,
    flex: 1,
  } as const;

  const listenButton = (
    <PressableFeedback
      key="listen"
      onPress={onListen}
      accessibilityRole="button"
      accessibilityLabel={de.lesson.listenTab}
      style={[styles.stickyButton, stickyActionStyle]}
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
      style={[styles.stickyButton, stickyActionStyle]}
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
              style={[styles.jumpChip, { borderColor: theme.colors.border, minHeight: 48 }]}
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
  showSpeaker,
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
  showSpeaker: boolean;
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
        {showSpeaker ? <Text style={[styles.speakerLabel, { color: theme.colors.textWeak }]}>{speakerLabel}</Text> : <View />}
        <View style={styles.blockActions} pointerEvents="box-none">
          <Pressable
            onPress={onToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? de.lesson.bookmarkRemove : `${de.lesson.bookmarkLabel} setzen`}
            accessibilityState={{ checked: isBookmarked }}
            style={[styles.iconButton, { zIndex: 2, minWidth: 48, minHeight: 48 }]}
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
            style={[styles.iconButton, { minWidth: 48, minHeight: 48 }]}
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
            style={[styles.secondaryButton, { borderColor: theme.colors.border, minHeight: 48, marginTop: theme.spacing.xs }]}
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
            style={[styles.secondaryButton, { borderColor: theme.colors.border, minHeight: 48, marginTop: theme.spacing.base }]}
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
  blockActions: { flexDirection: 'row', gap: 8 },
  iconButton: { padding: 8, alignItems: 'center', justifyContent: 'center' },
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stickyButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
