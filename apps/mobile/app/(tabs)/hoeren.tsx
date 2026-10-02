import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Headphones, ListMusic, MoreVertical, Play, Search } from 'lucide-react-native';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { loadContentSnapshot } from '../../src/content/generation.js';
import { buildModuleList, type ModuleListEntry } from '../../src/content/listLessons.js';
import { listProgress } from '../../src/data/index.js';
import { downloadLesson, cancelDownload, getDownloadedStorageBytes, isDownloaded, playLesson, deleteDownload, enqueueModule } from '../../src/player/index.js';
import { PlaylistsSection } from '../../src/components/PlaylistsSection.js';
import { formatBytes } from '../../src/player/downloads.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { FadeInUp } from '../../src/motion/FadeInUp.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';
import { motionStaggerDelay } from '../../src/motion/stagger.js';
import { usePlayerStore } from '../../src/player/store.js';
import { reconcileDownloadedUiState } from '../../src/player/downloadedUiState.js';
import { downloadedLessonIds } from '../../src/player/downloadedBatch.js';
import { loadLessonSearchIndex } from '../../src/settings/lessonSearchIndex.js';
import { createLessonSearchEntry, searchLessonEntries, type LessonSearchEntry } from '../../src/settings/lessonSearch.js';

interface ContinueCard {
  lessonId: string;
  title: string;
}

export default function HoerenScreen() {
  const theme = useTheme();
  const bottomInset = useBottomChromeInset();
  const downloadStates = usePlayerStore((s) => s.downloads);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<LessonSearchEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const searchIndexRequest = useRef(0);
  const loadRequest = useRef(0);
  const [modules, setModules] = useState<ModuleListEntry[]>([]);
  const [continueCard, setContinueCard] = useState<ContinueCard | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [playbackError, setPlaybackError] = useState(false);
  const [playlistPlaybackError, setPlaylistPlaybackError] = useState(false);
  const [requestAddLessonId, setRequestAddLessonId] = useState<string | null>(null);

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

  const load = useCallback(async (background = false) => {
    const request = ++loadRequest.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const fs = await getContentFs();
      const [snapshot, progressRows] = await Promise.all([loadContentSnapshot(fs), listProgress()]);
      const manifest = snapshot.manifest;
      const modulesFile = snapshot.modules;
      if (modulesFile) {
        const list = await buildModuleList(modulesFile, manifest, fs, snapshot);

        const allLessonIds = list.flatMap((module) => module.subModules.flatMap((sub) => sub.lessons.map((lesson) => lesson.id)));
        const downloadedIds = await downloadedLessonIds(allLessonIds, snapshot, isDownloaded);
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
    if (!query.trim()) return modules;
    return modules.map((module) => ({
      ...module,
      subModules: module.subModules.map((sub) => ({ ...sub, lessons: sub.lessons.filter((lesson) => matchingLessonIds.has(lesson.id)) })).filter((sub) => sub.lessons.length > 0),
    })).filter((module) => module.subModules.length > 0);
  }, [matchingLessonIds, modules, query]);

  if (loading && !hasLoadedOnce) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg, justifyContent: 'center' }]}>
        <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} />
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
          <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} />
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
        <TabScreenTitle title={de.hoeren.title} includeSafeAreaTop={false} />
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

        <View style={[styles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}>
          <Search color={theme.colors.textWeak} size={18} />
          <TextInput testID="audio-search-input" value={query} onChangeText={setQuery} placeholder={de.hoeren.searchPlaceholder} placeholderTextColor={theme.colors.textWeak} accessibilityLabel={de.hoeren.searchPlaceholder} returnKeyType="search" style={[styles.searchInput, { color: theme.colors.text }]} />
          {query ? <Pressable testID="audio-search-clear" accessibilityRole="button" accessibilityLabel={de.hoeren.clearSearch} onPress={() => setQuery('')} style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>×</Text></Pressable> : null}
        </View>
        {query.trim() && indexLoading ? <Text style={{ color: theme.colors.textWeak }}>{de.hoeren.searchIndexLoading}</Text> : null}

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

        {continueCard ? (
          <PressableFeedback
            testID="hoeren-continue-play"
            onPress={() => void runPlayback(() => playLesson(continueCard.lessonId))}
            accessibilityRole="button"
            accessibilityLabel={`${de.hoeren.continueCard}: ${continueCard.title}`}
          >
            <View
              style={[
                styles.continueCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderLeftColor: theme.colors.accent,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.base,
                  minHeight: theme.minTapTarget,
                },
              ]}
            >
              <Text style={[styles.cardLabel, { color: theme.colors.textWeak }]}>{de.hoeren.continueCard}</Text>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{continueCard.title}</Text>
              <Text style={[styles.continueCta, { color: theme.colors.accent, marginTop: theme.spacing.sm }]}>
                {de.hoeren.continuePlayAction}
              </Text>
            </View>
          </PressableFeedback>
        ) : null}

        {query.trim() && visibleModules.length === 0 && !indexLoading ? <Text style={{ color: theme.colors.textWeak }}>{de.hoeren.searchNoResults}</Text> : null}
        {visibleModules.map((module, moduleIndex) => (
          <FadeInUp key={module.id} durationMs={200} delayMs={motionStaggerDelay(moduleIndex + 1)}>
          <View style={styles.moduleBlock}>
            <View style={styles.moduleHeader}>
              <Text style={[styles.moduleTitle, { color: theme.colors.text, flex: 1, minWidth: 0 }]}>{module.title}</Text>
              <Pressable
                onPress={() => {
                  void runPlayback(async () => {
                    await enqueueModule(module.id);
                    const first = module.subModules[0]?.lessons[0];
                    if (first) await playLesson(first.id);
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

            {module.subModules.flatMap((sub) => sub.lessons).map((lesson) => {
              const downloadState = downloadStates[lesson.id];
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
                <PressableFeedback
                  onPress={() => void runPlayback(() => playLesson(lesson.id))}
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
                </PressableFeedback>
                {downloadState?.status === 'downloading' ? (
                  <View accessibilityLabel={`Download ${Math.round(downloadState.progress * 100)} Prozent`} style={{ minWidth: 42, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.textWeak, fontSize: 10 }}>{Math.round(downloadState.progress * 100)}%</Text>
                    <PressableFeedback onPress={() => void runPlayback(async () => { await cancelDownload(lesson.id); return reconcileDownloadedFlag(lesson.id); })} accessibilityRole="button" accessibilityLabel="Download abbrechen" style={{ padding: 4 }}>
                      <Text style={{ color: theme.colors.textWeak, fontSize: 10 }}>Abbrechen</Text>
                    </PressableFeedback>
                  </View>
                ) : downloadState?.status === 'error' ? (
                  <PressableFeedback onPress={() => void runPlayback(async () => { const result = await downloadLesson(lesson.id); await reconcileDownloadedFlag(lesson.id); return result; })} accessibilityRole="button" accessibilityLabel="Download erneut versuchen" style={{ padding: 4 }}>
                    <Text style={{ color: theme.colors.error, fontSize: 11, maxWidth: 64 }} numberOfLines={2}>Erneut versuchen</Text>
                  </PressableFeedback>
                ) : null}
                <PressableFeedback
                  onPress={() => void runPlayback(() => playLesson(lesson.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.playLesson}: ${lesson.title}`}
                  style={[styles.lessonTextBlock, { flex: 1, minWidth: 0 }]}
                >
                  <Text numberOfLines={3} ellipsizeMode="tail" style={[styles.lessonTitle, { color: theme.colors.text }]}>
                    {lesson.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.lessonDuration, { color: theme.colors.textWeak }]}>
                    {de.hoeren.durationMinutes(lesson.durationMinutes)}
                  </Text>
                </PressableFeedback>
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

        <StorageSection downloaded={downloaded} onCleared={() => setDownloaded({})} />
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
  downloaded,
  onCleared,
}: {
  downloaded: Record<string, boolean>;
  onCleared: () => void;
}) {
  const theme = useTheme();
  const downloadedIds = Object.entries(downloaded)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const [bytesUsed, setBytesUsed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (downloadedIds.length === 0) {
      setBytesUsed(null);
      return;
    }
    void getDownloadedStorageBytes(downloadedIds).then((bytes) => {
      if (!cancelled) setBytesUsed(bytes);
    });
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
      <Pressable
        onPress={() => {
          void (async () => {
            for (const id of downloadedIds) await deleteDownload(id);
            onCleared();
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
