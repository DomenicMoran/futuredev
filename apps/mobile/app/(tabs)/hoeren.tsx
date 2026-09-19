import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Headphones, Download, ListMusic, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { loadLocalManifest, loadModules } from '../../src/content/lessonLoader.js';
import { buildModuleList, type ModuleListEntry } from '../../src/content/listLessons.js';
import { listProgress } from '../../src/data/index.js';
import { downloadLesson, isDownloaded, playLesson, deleteDownload, enqueueModule } from '../../src/player/index.js';
import { formatBytes } from '../../src/player/downloads.js';

interface ContinueCard {
  lessonId: string;
  title: string;
}

export default function HoerenScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleListEntry[]>([]);
  const [continueCard, setContinueCard] = useState<ContinueCard | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
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
        setContinueCard({ lessonId: lastStarted.lessonId, title: lesson?.title ?? lastStarted.lessonId });
      } else {
        setContinueCard(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (modules.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={Headphones} title={de.hoeren.emptyTitle} body={de.hoeren.emptyBody} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.base, gap: theme.spacing.lg }}>
        {continueCard ? (
          <Pressable
            onPress={() => void playLesson(continueCard.lessonId)}
            accessibilityRole="button"
            accessibilityLabel={`${de.hoeren.continueCard}: ${continueCard.title}`}
            style={[
              styles.card,
              { backgroundColor: theme.colors.accent, minHeight: theme.minTapTarget, borderRadius: theme.radius.lg },
            ]}
          >
            <Text style={[styles.cardLabel, { color: theme.colors.accentText }]}>{de.hoeren.continueCard}</Text>
            <Text style={[styles.cardTitle, { color: theme.colors.accentText }]}>{continueCard.title}</Text>
          </Pressable>
        ) : null}

        {modules.map((module) => (
          <View key={module.id} style={styles.moduleBlock}>
            <View style={styles.moduleHeader}>
              <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>
                {module.id} · {module.title}
              </Text>
              <Pressable
                onPress={() => {
                  void (async () => {
                    await enqueueModule(module.id);
                    const first = module.subModules[0]?.lessons[0];
                    if (first) await playLesson(first.id);
                  })();
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
              <Pressable
                key={lesson.id}
                onPress={() => void playLesson(lesson.id)}
                accessibilityRole="button"
                accessibilityLabel={`${lesson.title}, ${lesson.durationMinutes} Minuten, ${downloaded[lesson.id] ? de.hoeren.downloaded : de.hoeren.notDownloaded}`}
                style={[
                  styles.lessonRow,
                  { minHeight: theme.minTapTarget, borderColor: theme.colors.border, borderRadius: theme.radius.md },
                ]}
              >
                <Text numberOfLines={1} style={[styles.lessonTitle, { color: theme.colors.text }]}>
                  {lesson.title}
                </Text>
                <Text style={[styles.lessonDuration, { color: theme.colors.textWeak }]}>{lesson.durationMinutes} Min</Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      if (downloaded[lesson.id]) {
                        await deleteDownload(lesson.id);
                        setDownloaded((d) => ({ ...d, [lesson.id]: false }));
                      } else {
                        await downloadLesson(lesson.id);
                        setDownloaded((d) => ({ ...d, [lesson.id]: true }));
                      }
                    })();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={downloaded[lesson.id] ? de.player.deleteDownload : de.player.download}
                  hitSlop={8}
                  style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}
                >
                  {downloaded[lesson.id] ? (
                    <Trash2 color={theme.colors.textWeak} size={18} />
                  ) : (
                    <Download color={theme.colors.accent} size={18} />
                  )}
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))}

        <StorageSection downloaded={downloaded} onCleared={() => setDownloaded({})} />
      </ScrollView>
    </SafeAreaView>
  );
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

  if (downloadedIds.length === 0) return null;

  return (
    <View style={[styles.storage, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{de.hoeren.storageTitle}</Text>
      <Text style={{ color: theme.colors.textWeak }}>
        {de.hoeren.storageUsed(formatBytes(downloadedIds.length * 8_900_000))}
      </Text>
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
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  moduleBlock: { gap: 8 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moduleTitle: { fontSize: 16, fontWeight: '700' },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lessonTitle: { flex: 1, fontSize: 15 },
  lessonDuration: { fontSize: 13 },
  storage: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
});
