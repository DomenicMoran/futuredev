import { MasteryCard } from '../../src/mastery/MasteryCard.js';
import { matchesListeningFilter } from '../../src/player/listeningFilter.js';
import { ContinueListeningCard } from '../../src/components/ContinueListeningCard.js';
import { ProgressOverview } from '../../src/components/ProgressOverview.js';
import { LessonStatusActions } from '../../src/components/LessonStatusActions.js';
import { useContent } from '../../src/content/ContentProvider.js';
import { EMPTY_LESSON_STATUS, lessonStatusLabel } from '../../src/data/lessonStatus.js';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Headphones, ListMusic, MoreVertical, Play, Search } from 'lucide-react-native';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { ensureBundledContent } from '../../src/content/bundledContent.js';
import { bundledContent } from '../../src/content/bundledData.js';
import { loadContentSnapshot } from '../../src/content/generation.js';
import { buildModuleList, type ModuleListEntry } from '../../src/content/listLessons.js';
import { listProgress } from '../../src/data/index.js';
import { downloadLesson, cancelDownload, getDownloadedStorageBytes, isDownloaded, playLessonInModuleContext, resumeLessonInModuleContext, deleteDownload } from '../../src/player/index.js';
import { batchDownloads } from '../../src/player/batchDownloads.js';
import { listHearingProgress } from '../../src/player/hearingProgress.js';
import { PlaylistsSection } from '../../src/components/PlaylistsSection.js';
import { formatBytes, downloadDirPath } from '../../src/player/downloads.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { FadeInUp } from '../../src/motion/FadeInUp.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';
import { motionStaggerDelay } from '../../src/motion/stagger.js';
import { usePlayerStore } from '../../src/player/store.js';
import { reconcileDownloadAvailability, reconcileDownloadedUiState } from '../../src/player/downloadedUiState.js';
import { downloadedLessonIds } from '../../src/player/downloadedBatch.js';
import { loadLessonSearchIndex } from '../../src/settings/lessonSearchIndex.js';
import { createLessonSearchEntry, searchLessonEntries, type LessonSearchEntry } from '../../src/settings/lessonSearch.js';

interface ContinueCard {
  lessonId: string;
  title: string;
}

export default function HoerenScreen() {
  const theme = useTheme();
  const { statuses, moduleList: cachedModules } = useContent();
  const [filter, setFilter] = useState('all');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const bottomInset = useBottomChromeInset();
  const downloadStates = usePlayerStore((s) => s.downloads);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const batch = useSyncExternalStore(batchDownloads.subscribe, batchDownloads.getSnapshot, batchDownloads.getSnapshot);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hearing, setHearing] = useState<Awaited<ReturnType<typeof listHearingProgress>>>({});
  const [previousHearing, setPreviousHearing] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => { void listHearingProgress().then((value) => { if (active) setHearing(value); }).catch(() => undefined); };
    refresh();
    const timer = isPlaying ? setInterval(refresh, 5000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [isPlaying]));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<LessonSearchEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const searchIndexRequest = useRef(0);
  const loadRequest = useRef(0);
  const [modules, setModules] = useState<ModuleListEntry[]>(() => cachedModules);
  useEffect(() => { if (cachedModules.length) setModules(current => current.length ? current : cachedModules); }, [cachedModules]);
  const [continueCard, setContinueCard] = useState<ContinueCard | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [playbackError, setPlaybackError] = useState(false);
  const [playlistPlaybackError, setPlaylistPlaybackError] = useState(false);
  const [requestAddLessonId, setRequestAddLessonId] = useState<string | null>(null);
  useEffect(() => { if (batch.running || requestAddLessonId) setToolsOpen(true); }, [batch.running, requestAddLessonId]);

  // Faengt einen Fehler beim Starten der Wiedergabe/Warteschlange ab
  // (Pruefbericht Phase 3, B-01: ein ungueltiges Manifest/eine ungueltige
  // Basis-URL darf nie als unbehandelte Promise-Ablehnung enden), zeigt
  // stattdessen ein Banner mit de.player.loadError statt eines Absturzes.
  const runPlayback = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setPlaybackError(false);
    try {
      const result = await action();
      return result !== 'cancelled';
    } catch {
      setPlaybackError(true);
      return false;
    }
  }, []);

  const reconcileDownloadedFlag = useCallback(async (lessonId: string): Promise<boolean> => {
    const persisted = await isDownloaded(lessonId).catch(() => false);
    setDownloaded((current) => reconcileDownloadedUiState(current, lessonId, persisted));
    return persisted;
  }, []);

  useEffect(() => {
    setDownloaded((current) => reconcileDownloadAvailability(current, downloadStates));
  }, [downloadStates]);

  const load = useCallback(async (background = false) => {
    const request = ++loadRequest.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const fs = await getContentFs();
      await ensureBundledContent(fs, bundledContent);
      const [snapshot, progressRows] = await Promise.all([loadContentSnapshot(fs), listProgress()]);
      if (request === loadRequest.current) setPreviousHearing(new Set(progressRows.filter((row) => (row.listenedUntil ?? 0) > 0).map((row) => row.lessonId)));
      const manifest = snapshot.manifest;
      const modulesFile = snapshot.modules;
      if (modulesFile) {
        const list = await buildModuleList(modulesFile, manifest, fs, snapshot);

        const allLessonIds = list.flatMap((module) => module.subModules.flatMap((sub) => sub.lessons.map((lesson) => lesson.id)));
        // Most users have no downloads: do not re-read all 197 lesson payloads
        // merely to find that their audio files do not exist.
        const audioFiles = await fs.listDirectory(downloadDirPath(fs.documentDirectory));
        const candidateIds = new Set(audioFiles.map((name) => name.match(/^(M\d{2}-\d{2}-\d{2})\./)?.[1]).filter(Boolean));
        const downloadedIds = await downloadedLessonIds(allLessonIds.filter((id) => candidateIds.has(id)), snapshot, isDownloaded);
        const visibleModules = list.filter((m) => m.totalLessons > 0);
        const lastStarted = [...progressRows]
          .filter((p) => p.state !== 'new')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const lastLesson = lastStarted
          ? list.flatMap((m) => m.subModules).flatMap((sub) => sub.lessons).find((l) => l.id === lastStarted.lessonId)
          : undefined;
        if (request !== loadRequest.current) return;
        setModules(visibleModules);
        setDownloaded(Object.fromEntries([...downloadedIds].map((id) => [id, true])));
        setContinueCard(lastStarted ? { lessonId: lastStarted.lessonId, title: lastLesson?.title ?? de.hoeren.continueTitleFallback } : null);
        setLoadError(false);
      } else {
        throw new Error('Lerninhalte sind gerade nicht verfügbar');
      }
    } catch {
      if (request === loadRequest.current) setLoadError(true);
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
        setRefreshing(false);
        setHasLoadedOnce(true);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce) void load(true);
    }, [load, hasLoadedOnce]),
  );

  useEffect(() => {
    let cancelled = false;
    const request = ++searchIndexRequest.current;
    setIndexLoading(true);
    void (async () => {
      try {
        const fs = await getContentFs();
        const result = await loadLessonSearchIndex(fs, modules);
        if (!cancelled && request === searchIndexRequest.current) setSearchIndex(result.entries);
      } catch {
        const fallback = modules.flatMap((module) => module.subModules.flatMap((sub) => sub.lessons.map((lesson) => createLessonSearchEntry(lesson.id, lesson.title, module.title, sub.title, null))));
        if (!cancelled && request === searchIndexRequest.current) setSearchIndex(fallback);
      } finally {
        if (!cancelled && request === searchIndexRequest.current) setIndexLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modules]);

  const matchingLessonIds = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('de-DE');
    return new Set(term ? searchLessonEntries(searchIndex, term).map((entry) => entry.id) : []);
  }, [query, searchIndex]);
  const visibleModules = useMemo(() => {
    return modules.map((module) => ({
      ...module,
      subModules: module.subModules.map((sub) => ({ ...sub, lessons: sub.lessons.filter((lesson) => {
        const status = statuses[lesson.id] ?? EMPTY_LESSON_STATUS;
        return matchesListeningFilter(lesson.id, filter, status, Boolean(downloaded[lesson.id]), !query.trim() || matchingLessonIds.has(lesson.id), editingLessonId);
      }) })).filter((sub) => sub.lessons.length > 0),
    })).filter((module) => module.subModules.length > 0);
  }, [matchingLessonIds, modules, query, filter, statuses, downloaded, editingLessonId]);

  if (loading && !hasLoadedOnce && modules.length === 0) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg, justifyContent: 'center' }]}>
        <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} /><MasteryCard />
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textWeak, textAlign: 'center', marginTop: theme.spacing.sm }}>{de.hoeren.loadingBody}</Text>
      </SafeAreaView>
    );
  }

  const hasAnyDownload = Object.values(downloaded).some(Boolean);

  if (modules.length === 0) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: bottomInset, gap: theme.spacing.lg }}>
          <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} /><MasteryCard />
          <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.lg }}>
          {loadError ? <View accessibilityRole="alert"><Text style={{ color: theme.colors.error }}>{de.hoeren.loadError}</Text><Pressable testID="hoeren-retry" accessibilityRole="button" onPress={() => void load(false)} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>{de.hoeren.retry}</Text></Pressable></View> : null}
          {refreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{de.hoeren.refreshing}</Text>
            </View>
          ) : null}
          {loadError ? null : <EmptyState Icon={Headphones} title={de.hoeren.emptyTitle} body={de.hoeren.emptyBody} />}
          <PlaylistsSection
            lessonTitleFor={(lessonId) => lessonId}
            onPlaybackError={(empty) => {
              if (empty) setPlaylistPlaybackError(true);
            }}
            requestAddLessonId={requestAddLessonId}
            onRequestAddHandled={() => setRequestAddLessonId(null)}
          />
          {playlistPlaybackError ? (
            <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error }}>{de.hoeren.playlistEmptyPlayError}</Text>
            </View>
          ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset, gap: theme.spacing.lg }}>
        <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} /><MasteryCard />
        <FadeInUp durationMs={200} delayMs={motionStaggerDelay(0)}>
        <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.lg }}>
        {refreshing ? (
          <View style={styles.refreshRow}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{de.hoeren.refreshing}</Text>
          </View>
        ) : null}
        {loadError ? <View accessibilityRole="alert"><Text style={{ color: theme.colors.error }}>{de.hoeren.loadError}</Text><Pressable testID="hoeren-retry" accessibilityRole="button" onPress={() => void load(true)} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>{de.hoeren.retry}</Text></Pressable></View> : null}
        {playbackError ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
            <Text style={{ color: theme.colors.error }}>{de.player.loadError}</Text>
          </View>
        ) : null}

        <ContinueListeningCard />
        <ProgressOverview />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {([['all', 'Alle'], ['started', 'Angefangen'], ['unheard', 'Ungehört'], ['heard', 'Gehört'], ['offline', 'Offline']] as const).map(([key, label]) => <Pressable key={key} testID={`audio-filter-${key}`} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, backgroundColor: filter === key ? theme.colors.accent : theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border }}><Text style={{ color: filter === key ? theme.colors.bg : theme.colors.text, fontWeight: '600' }}>{label}</Text></Pressable>)}
        </ScrollView>
        {visibleModules.length === 0 && !indexLoading ? <View style={{ gap: 4 }}><Text style={{ color: theme.colors.textWeak }}>Keine Lektionen für diese Auswahl.</Text><Pressable accessibilityRole="button" onPress={() => { setFilter('all'); setQuery(''); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>Alle Lektionen anzeigen</Text></Pressable></View> : null}
        <View style={[styles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}>
          <Search color={theme.colors.textWeak} size={18} />
          <TextInput testID="audio-search-input" value={query} onChangeText={setQuery} placeholder={de.hoeren.searchPlaceholder} placeholderTextColor={theme.colors.textWeak} accessibilityLabel={de.hoeren.searchPlaceholder} returnKeyType="search" style={[styles.searchInput, { color: theme.colors.text }]} />
          {query ? <Pressable testID="audio-search-clear" accessibilityRole="button" accessibilityLabel={de.hoeren.clearSearch} onPress={() => setQuery('')} style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>×</Text></Pressable> : null}
        </View>
        {query.trim() && indexLoading ? <Text style={{ color: theme.colors.textWeak }}>{de.hoeren.searchIndexLoading}</Text> : null}

        <View>
          <Pressable testID="audio-tools-toggle" accessibilityRole="button" accessibilityState={{ expanded: toolsOpen || selecting || batch.running || !!requestAddLessonId }} onPress={() => setToolsOpen(!toolsOpen)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: theme.colors.accent, fontWeight: '600', flex: 1 }}>Downloads & Wiedergabelisten{batch.running ? ' · läuft' : ''}</Text><Text style={{ color: theme.colors.accent }}>{toolsOpen || selecting || batch.running || requestAddLessonId ? '−' : '+'}</Text>
          </Pressable>
          {toolsOpen || selecting || batch.running || requestAddLessonId ? <View style={{ gap: theme.spacing.lg }}>
        <View style={[styles.offlineHint, { borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.base, gap: 8 }]}>
          <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>Offline hören</Text>
          <Text style={{ color: theme.colors.textWeak }}>Einzelne Lektionen auswählen oder ein ganzes Modul laden. Bereits verfügbare Dateien werden übersprungen.</Text>
          <Pressable accessibilityRole="button" testID="audio-select-toggle" onPress={() => { setSelecting(!selecting); setSelected(new Set()); }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.accent }}>{selecting ? 'Auswahl beenden' : 'Mehrere auswählen'}</Text>
          </Pressable>
          {selecting ? <Pressable accessibilityRole="button" testID="audio-download-selected" disabled={batch.running || !selected.size} accessibilityState={{ disabled: batch.running || !selected.size }} onPress={() => { void batchDownloads.start([...selected]); setSelected(new Set()); }} style={{ minHeight: 48, justifyContent: 'center', opacity: batch.running || !selected.size ? 0.5 : 1 }}>
            <Text style={{ color: theme.colors.accent }}>{selected.size} Lektionen herunterladen</Text>
          </Pressable> : null}
          {Object.keys(batch.items).length ? <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
            <Text testID="audio-batch-summary" style={{ color: theme.colors.text }}>{batch.running ? 'Downloads laufen' : 'Downloadrunde beendet'}: {Object.values(batch.items).filter((status) => status === 'downloaded' || status === 'skipped').length} / {Object.keys(batch.items).length} offline verfügbar</Text>
            {Object.values(batch.items).includes('failed') ? <Text style={{ color: theme.colors.error }}>{Object.values(batch.items).filter((status) => status === 'failed').length} fehlgeschlagen. Verbindung und freien Speicher prüfen.</Text> : null}
            {Object.values(batch.items).includes('cancelled') ? <Text style={{ color: theme.colors.textWeak }}>{Object.values(batch.items).filter((status) => status === 'cancelled').length} abgebrochen</Text> : null}
            {batch.running ? <Pressable accessibilityRole="button" testID="audio-batch-cancel" onPress={() => void batchDownloads.cancel()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>Downloads abbrechen</Text></Pressable> : Object.values(batch.items).some((status) => status === 'failed' || status === 'cancelled') ? <Pressable accessibilityRole="button" testID="audio-batch-retry" onPress={() => void batchDownloads.retry()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>Offene Downloads erneut versuchen</Text></Pressable> : null}
          </View> : null}
        </View>

        {!hasAnyDownload ? (
          <View
            style={[
              styles.offlineHint,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                padding: theme.spacing.base,
              },
            ]}
          >
            <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{de.hoeren.offlineEmptyHint}</Text>
            {continueCard ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={de.hoeren.offlineEmptyCta}
                onPress={() => {
                  void (async () => {
                    await runPlayback(async () => {
                      const result = await downloadLesson(continueCard.lessonId);
                      await reconcileDownloadedFlag(continueCard.lessonId);
                      return result;
                    });
                  })();
                }}
                style={{ minHeight: theme.minTapTarget, justifyContent: 'center', marginTop: theme.spacing.sm }}
              >
                <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>{de.hoeren.offlineEmptyCta}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {playlistPlaybackError ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
            <Text style={{ color: theme.colors.error }}>{de.hoeren.playlistEmptyPlayError}</Text>
          </View>
        ) : null}

        <PlaylistsSection
          lessonTitleFor={(lessonId) => {
            const lesson = modules
              .flatMap((m) => m.subModules)
              .flatMap((sub) => sub.lessons)
              .find((l) => l.id === lessonId);
            return lesson?.title ?? de.start.lessonTitleFallback;
          }}
          onPlaybackError={(empty) => {
            if (empty) setPlaylistPlaybackError(true);
            else setPlaybackError(true);
          }}
          requestAddLessonId={requestAddLessonId}
          onRequestAddHandled={() => setRequestAddLessonId(null)}
        />

          </View> : null}
        </View>

        {visibleModules.map((module, moduleIndex) => (
          <FadeInUp key={module.id} durationMs={200} delayMs={motionStaggerDelay(moduleIndex + 1)}>
          <View style={styles.moduleBlock}>
            <View style={styles.moduleHeader}>
              <Text style={[styles.moduleTitle, { color: theme.colors.text, flex: 1, minWidth: 0 }]}>{module.title}</Text>
              <Pressable
                onPress={() => {
                  void runPlayback(async () => {
                    const first = module.subModules[0]?.lessons[0];
                    if (first) await playLessonInModuleContext(first.id);
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${de.hoeren.playModule}: ${module.title}`}
                hitSlop={8}
                style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <ListMusic color={theme.colors.accent} size={20} />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" testID={`download-module-${module.id}`} accessibilityLabel={`Ganzes Modul offline laden: ${module.title}`} disabled={batch.running} accessibilityState={{ disabled: batch.running }} onPress={() => void batchDownloads.start((modules.find((entry) => entry.id === module.id)?.subModules ?? []).flatMap((sub) => sub.lessons.map((lesson) => lesson.id)))} style={{ minHeight: 48, justifyContent: 'center', opacity: batch.running ? 0.5 : 1 }}>
              <Text style={{ color: theme.colors.accent }}>Ganzes Modul offline laden</Text>
            </Pressable>
            {module.subModules.flatMap((sub) => sub.lessons).map((lesson) => {
              const downloadState = downloadStates[lesson.id];
              const heard = hearing[lesson.id];
              const status = statuses[lesson.id] ?? EMPTY_LESSON_STATUS;
              return (
              <View
                key={lesson.id}
                style={[
                  styles.lessonRow,
                  {
                    minHeight: theme.minTapTarget,
                    borderColor: theme.colors.border,
                    borderLeftColor: theme.colors.accent,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                {selecting ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`${lesson.title} für Offline auswählen`} accessibilityState={{ checked: selected.has(lesson.id) }} testID={`select-download-${lesson.id}`} onPress={() => toggleSelected(lesson.id)} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.colors.accent, fontSize: 24 }}>{selected.has(lesson.id) ? '☑' : '☐'}</Text></Pressable> : null}
                {!selecting ? <PressableFeedback
                  onPress={() => void runPlayback(() => resumeLessonInModuleContext(lesson.id, status.heard ? 0 : status.listenedUntil))}
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.playLesson}: ${lesson.title}`}
                  hitSlop={8}
                  style={[
                    styles.lessonPlayButton,
                    {
                      minWidth: theme.minTapTarget,
                      minHeight: theme.minTapTarget,
                    },
                  ]}
                >
                  <Play color={theme.colors.accent} size={20} />
                </PressableFeedback> : null}
                {downloadState?.status === 'downloading' ? (
                  <View accessibilityLabel={`Download ${Math.round(downloadState.progress * 100)} Prozent`} style={{ minWidth: 42, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.textWeak, fontSize: 10 }}>{Math.round(downloadState.progress * 100)}%</Text>
                    <PressableFeedback onPress={() => void runPlayback(async () => { await cancelDownload(lesson.id); return reconcileDownloadedFlag(lesson.id); })} accessibilityRole="button" accessibilityLabel="Download abbrechen" style={{ padding: 4, minHeight: 48, minWidth: 48, justifyContent: 'center' }}>
                      <Text style={{ color: theme.colors.textWeak, fontSize: 10 }}>Abbrechen</Text>
                    </PressableFeedback>
                  </View>
                ) : downloadState?.status === 'error' ? (
                  <PressableFeedback onPress={() => void runPlayback(async () => { const result = await downloadLesson(lesson.id); await reconcileDownloadedFlag(lesson.id); return result; })} accessibilityRole="button" accessibilityLabel="Download erneut versuchen" style={{ padding: 4, minHeight: 48, minWidth: 48, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.error, fontSize: 11, maxWidth: 64 }} numberOfLines={2}>Erneut versuchen</Text>
                  </PressableFeedback>
                ) : null}
                <PressableFeedback
                  onPress={() => void runPlayback(() => resumeLessonInModuleContext(lesson.id, status.heard ? 0 : status.listenedUntil))}
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.playLesson}: ${lesson.title}`}
                  style={[styles.lessonTextBlock, { flex: 1, minWidth: 0 }]}
                >
                  <Text numberOfLines={3} ellipsizeMode="tail" style={[styles.lessonTitle, { color: theme.colors.text }]}>
                    {lesson.title}
                  </Text>
                  <Text testID={`hearing-status-${lesson.id}`} style={{ color: status.heard ? theme.colors.accent : theme.colors.textWeak, fontSize: 12 }}>
                    {status.overrides.heard === false ? 'Als ungehört markiert' : status.heard ? (status.overrides.heard === true ? 'Als gehört markiert' : 'Vollständig gehört') : heard && heard.seconds > 0 ? `Angefangen · ${Math.max(1, Math.min(99, Math.round(heard.seconds / Math.max(1, heard.duration) * 100)))} % gehört` : previousHearing.has(lesson.id) ? 'Früherer Hörfortschritt vorhanden' : 'Ungehört'}
                    {downloaded[lesson.id] ? ' · Offline verfügbar' : batch.items[lesson.id] === 'queued' ? ' · Download wartet' : ''}
                  </Text>
                  {status.read || status.done || status.quizPassed ? <Text style={{ color: theme.colors.textWeak, fontSize: 12 }}>{lessonStatusLabel({ ...status, heard: false })}</Text> : null}
                  <Text numberOfLines={1} style={[styles.lessonDuration, { color: theme.colors.textWeak }]}>
                    {lesson.durationSeconds !== undefined ? `${Math.floor(lesson.durationSeconds / 60)}:${String(Math.floor(lesson.durationSeconds % 60)).padStart(2, '0')} Audio` : de.hoeren.durationMinutes(lesson.durationMinutes)}
                  </Text>
                </PressableFeedback>
                <LessonStatusActions lessonId={lesson.id} title={lesson.title} compact onOpenChange={open => setEditingLessonId(open ? lesson.id : null)} />
                <PressableFeedback
                  onPress={() =>
                    openLessonMoreMenu({
                      lessonTitle: lesson.title,
                      isDownloaded: Boolean(downloaded[lesson.id]),
                      onAddPlaylist: () => setRequestAddLessonId(lesson.id),
                      onToggleDownload: () => {
                        void runPlayback(async () => {
                          if (downloaded[lesson.id]) {
                            await deleteDownload(lesson.id);
                            setDownloaded((d) => ({ ...d, [lesson.id]: false }));
                          } else {
                            const result = await downloadLesson(lesson.id);
                            await reconcileDownloadedFlag(lesson.id);
                            return result;
                          }
                        });
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.lessonMoreMenu}: ${lesson.title}`}
                  hitSlop={8}
                  style={{
                    minWidth: theme.minTapTarget,
                    minHeight: theme.minTapTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MoreVertical color={theme.colors.textWeak} size={20} />
                </PressableFeedback>
              </View>
              );
            })}
          </View>
          </FadeInUp>
        ))}

        <StorageSection downloaded={downloaded} busy={batch.running} onCleared={() => setDownloaded({})} />
          </View>
        </FadeInUp>
      </ScrollView>
    </SafeAreaView>
  );
}

function openLessonMoreMenu(options: {
  lessonTitle: string;
  isDownloaded: boolean;
  onAddPlaylist: () => void;
  onToggleDownload: () => void;
}) {
  const downloadLabel = options.isDownloaded ? de.hoeren.offlineRemove : de.hoeren.offlineLoad;
  const playlistLabel = de.hoeren.playlistAddLesson;

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [de.common.cancel, playlistLabel, downloadLabel],
        cancelButtonIndex: 0,
        title: options.lessonTitle,
      },
      (index) => {
        if (index === 1) options.onAddPlaylist();
        if (index === 2) options.onToggleDownload();
      },
    );
    return;
  }

  Alert.alert(options.lessonTitle, undefined, [
    { text: de.common.cancel, style: 'cancel' },
    { text: playlistLabel, onPress: options.onAddPlaylist },
    { text: downloadLabel, onPress: options.onToggleDownload },
  ]);
}

function StorageSection({
  busy,
  downloaded,
  onCleared,
}: {
  busy: boolean;
  downloaded: Record<string, boolean>;
  onCleared: () => void;
}) {
  const theme = useTheme();
  const downloadedIds = Object.entries(downloaded)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const [clearError, setClearError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [bytesUsed, setBytesUsed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (downloadedIds.length === 0) {
      setBytesUsed(null);
      return;
    }
    void getDownloadedStorageBytes(downloadedIds).then((bytes) => {
      if (!cancelled) setBytesUsed(bytes);
    }).catch(() => { if (!cancelled) setBytesUsed(null); });
    return () => {
      cancelled = true;
    };
  }, [downloadedIds.join('|')]);

  if (downloadedIds.length === 0) return null;

  return (
    <View
      style={[
        styles.storage,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.base,
        },
      ]}
    >
      <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{de.hoeren.storageTitle}</Text>
      {bytesUsed != null ? (
        <Text style={{ color: theme.colors.textWeak }}>{de.hoeren.storageUsed(formatBytes(bytesUsed))}</Text>
      ) : null}
      {clearError ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>Downloads konnten nicht vollständig entfernt werden. Bitte erneut versuchen.</Text> : null}
      <Pressable
        disabled={busy || clearing}
        accessibilityState={{ disabled: busy || clearing }}
        onPress={() => {
          setClearing(true); setClearError(false);
          void (async () => {
            try {
              for (const id of downloadedIds) await deleteDownload(id);
              onCleared();
            } catch { setClearError(true); }
            finally { setClearing(false); }
          })();
        }}
        accessibilityRole="button"
        accessibilityLabel={de.hoeren.deleteAll}
        style={{ minHeight: theme.minTapTarget, justifyContent: 'center', marginTop: theme.spacing.sm }}
      >
        <Text style={{ color: theme.colors.error, fontWeight: '600' }}>{de.hoeren.deleteAll}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { padding: 16, gap: 4 },
  continueCard: { gap: 4, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  continueCta: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  moduleBlock: { gap: 8 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moduleTitle: { fontSize: 16, fontWeight: '700' },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  lessonTextBlock: { justifyContent: 'center', gap: 2, paddingVertical: 8 },
  lessonTitle: { fontSize: 15, lineHeight: 20 },
  lessonDuration: { fontSize: 13, lineHeight: 18 },
  storage: { borderWidth: StyleSheet.hairlineWidth },
  banner: { padding: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  offlineHint: { borderWidth: StyleSheet.hairlineWidth },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginBottom: 4 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 16 },
  lessonPlayButton: { alignItems: 'center', justifyContent: 'center' },
});
