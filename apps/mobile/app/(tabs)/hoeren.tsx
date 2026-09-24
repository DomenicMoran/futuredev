import { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Headphones, ListMusic, MoreVertical, Play } from 'lucide-react-native';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { loadLocalManifest, loadModules } from '../../src/content/lessonLoader.js';
import { buildModuleList, type ModuleListEntry } from '../../src/content/listLessons.js';
import { listProgress } from '../../src/data/index.js';
import { downloadLesson, getDownloadedStorageBytes, isDownloaded, playLesson, deleteDownload, enqueueModule } from '../../src/player/index.js';
import { PlaylistsSection } from '../../src/components/PlaylistsSection.js';
import { formatBytes } from '../../src/player/downloads.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

interface ContinueCard {
  lessonId: string;
  title: string;
}

export default function HoerenScreen() {
  const theme = useTheme();
  const bottomInset = useBottomChromeInset();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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
  const runPlayback = useCallback(async (action: () => Promise<void>) => {
    setPlaybackError(false);
    try {
      await action();
    } catch {
      setPlaybackError(true);
    }
  }, []);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const fs = await getContentFs();
      const [manifest, modulesFile, progressRows] = await Promise.all([
        loadLocalManifest(fs),
        loadModules(fs),
        listProgress(),
      ]);
      if (modulesFile) {
        const list = await buildModuleList(modulesFile, manifest, fs);
        setModules(list.filter((m) => m.totalLessons > 0));

        const downloadedIds = new Set<string>();
        for (const m of list) {
          for (const sub of m.subModules) {
            for (const lesson of sub.lessons) {
              if (await isDownloaded(lesson.id)) downloadedIds.add(lesson.id);
            }
          }
        }
        setDownloaded(Object.fromEntries([...downloadedIds].map((id) => [id, true])));
      }

      const lastStarted = [...progressRows]
        .filter((p) => p.state !== 'new')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (lastStarted && modulesFile) {
        const list = await buildModuleList(modulesFile, manifest, fs);
        const lesson = list
          .flatMap((m) => m.subModules)
          .flatMap((sub) => sub.lessons)
          .find((l) => l.id === lastStarted.lessonId);
        setContinueCard({ lessonId: lastStarted.lessonId, title: lesson?.title ?? de.hoeren.continueTitleFallback });
      } else {
        setContinueCard(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
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

  if (loading && !hasLoadedOnce) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  const hasAnyDownload = Object.values(downloaded).some(Boolean);

  if (modules.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: bottomInset, gap: theme.spacing.lg }}>
          <TabScreenTitle title={de.hoeren.title} />
          <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.lg }}>
          {refreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{de.hoeren.refreshing}</Text>
            </View>
          ) : null}
          <EmptyState Icon={Headphones} title={de.hoeren.emptyTitle} body={de.hoeren.emptyBody} />
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset, gap: theme.spacing.lg }}>
        <TabScreenTitle title={de.hoeren.title} />
        <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.lg }}>
        {refreshing ? (
          <View style={styles.refreshRow}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{de.hoeren.refreshing}</Text>
          </View>
        ) : null}
        {playbackError ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
            <Text style={{ color: theme.colors.error }}>{de.player.loadError}</Text>
          </View>
        ) : null}

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
                    await downloadLesson(continueCard.lessonId);
                    setDownloaded((d) => ({ ...d, [continueCard.lessonId]: true }));
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
          <Pressable
            onPress={() => void runPlayback(() => playLesson(continueCard.lessonId))}
            accessibilityRole="button"
            accessibilityLabel={`${de.hoeren.continueCard}: ${continueCard.title}`}
            style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}
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
          </Pressable>
        ) : null}

        {modules.map((module) => (
          <View key={module.id} style={styles.moduleBlock}>
            <View style={styles.moduleHeader}>
              <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{module.title}</Text>
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

            {module.subModules.flatMap((sub) => sub.lessons).map((lesson) => (
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
                <Pressable
                  onPress={() => void runPlayback(() => playLesson(lesson.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.playLesson}: ${lesson.title}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.lessonPlayButton,
                    {
                      minWidth: theme.minTapTarget,
                      minHeight: theme.minTapTarget,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Play color={theme.colors.accent} size={20} />
                </Pressable>
                <Pressable
                  onPress={() => void runPlayback(() => playLesson(lesson.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`${de.hoeren.playLesson}: ${lesson.title}`}
                  style={({ pressed }) => [styles.lessonTextBlock, { opacity: pressed ? 0.92 : 1, flex: 1, minWidth: 0 }]}
                >
                  <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.lessonTitle, { color: theme.colors.text }]}>
                    {lesson.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.lessonDuration, { color: theme.colors.textWeak }]}>
                    {de.hoeren.durationMinutes(lesson.durationMinutes)}
                  </Text>
                </Pressable>
                <Pressable
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
                            await downloadLesson(lesson.id);
                            setDownloaded((d) => ({ ...d, [lesson.id]: true }));
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
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <StorageSection downloaded={downloaded} onCleared={() => setDownloaded({})} />
          </View>
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
  lessonPlayButton: { alignItems: 'center', justifyContent: 'center' },
});
