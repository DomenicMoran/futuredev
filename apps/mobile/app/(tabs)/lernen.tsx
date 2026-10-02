import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { ModuleCard } from '../../src/components/ModuleCard.js';
import { de } from '../../src/i18n/de.js';
import { useContent } from '../../src/content/ContentProvider.js';
import type { ModuleListEntry } from '../../src/content/listLessons.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { getContentFs } from '../../src/content/contentFs.js';
import { loadLessonSearchIndex } from '../../src/settings/lessonSearchIndex.js';
import { createLessonSearchEntry, searchLessonEntries, type LessonSearchEntry } from '../../src/settings/lessonSearch.js';

export default function LernenScreen() {
  const theme = useTheme();
  const { state, moduleList, refresh } = useContent();
  const bottomInset = useBottomChromeInset();
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<LessonSearchEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const searchIndexRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const request = ++searchIndexRequest.current;
    setIndexLoading(true);
    void (async () => {
      try {
        const fs = await getContentFs();
        const result = await loadLessonSearchIndex(fs, moduleList);
        if (!cancelled && request === searchIndexRequest.current) setSearchIndex(result.entries);
      } catch {
        const fallback = moduleList.flatMap((module) => module.subModules.flatMap((sub) =>
          sub.lessons.map((lesson) => ({
            ...createLessonSearchEntry(lesson.id, lesson.title, module.title, sub.title, null),
          })),
        ));
        if (!cancelled && request === searchIndexRequest.current) setSearchIndex(fallback);
      } finally {
        if (!cancelled && request === searchIndexRequest.current) setIndexLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [moduleList]);

  const loading = moduleList.length === 0 && state.status !== 'error';
  const filteredLessons = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('de-DE');
    return term ? searchLessonEntries(searchIndex, term) : [];
  }, [query, searchIndex]);

  const header = <View>
    {state.status === 'offline' ? <StatusBanner text={`${de.lernen.offlineBanner} ${formatDate(state.lastUpdatedAt)}`} color={theme.colors.warning} /> : null}
    {state.status === 'error' ? <View style={styles.errorWrap}><StatusBanner text={de.lernen.errorBanner} color={theme.colors.error} /><Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>{de.lernen.retry}</Text></Pressable></View> : null}
    {state.status === 'ok' && state.hasNewLessons ? <StatusBanner text={de.lernen.newLessonsBanner} color={theme.colors.accent} /> : null}
    <TabScreenTitle title={de.lernen.title} includeSafeAreaTop={false} />
    <View style={[styles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}>
      <Search color={theme.colors.textWeak} size={18} />
      <TextInput testID="lesson-search-input" value={query} onChangeText={setQuery} placeholder={de.lernen.searchPlaceholder} placeholderTextColor={theme.colors.textWeak} accessibilityLabel={de.lernen.searchPlaceholder} returnKeyType="search" style={[styles.searchInput, { color: theme.colors.text }]} />
      {query ? <Pressable testID="lesson-search-clear" accessibilityRole="button" accessibilityLabel={de.lernen.clearSearch} onPress={() => setQuery('')} style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>×</Text></Pressable> : null}
    </View>
    {query.trim() && indexLoading ? <Text style={[styles.indexLoading, { color: theme.colors.textWeak }]}>{de.lernen.searchIndexLoading}</Text> : null}
  </View>;

  if (loading) return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}><View style={styles.state}><ActivityIndicator color={theme.colors.accent} /><Text style={[styles.stateText, { color: theme.colors.textWeak }]}>{de.lernen.loadingBody}</Text></View></SafeAreaView>;
  if (state.status === 'error' && moduleList.length === 0) return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}><View style={styles.state}><BookOpen color={theme.colors.error} size={32} /><Text style={[styles.stateText, { color: theme.colors.error }]}>{de.lernen.errorBanner}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>{de.lernen.retry}</Text></Pressable></View></SafeAreaView>;

  const searching = Boolean(query.trim());
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
    {searching ? <FlatList<LessonSearchEntry>
      data={filteredLessons}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <Pressable testID={`lesson-search-result-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.moduleTitle}`} onPress={() => router.push(`/lesson/${item.id}`)} style={[styles.searchResult, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md, minHeight: theme.minTapTarget }]}><Text style={[styles.resultTitle, { color: theme.colors.text }]}>{item.title}</Text><Text style={[styles.resultMeta, { color: theme.colors.textWeak }]}>{item.moduleTitle} · {item.submoduleTitle}</Text></Pressable>}
      ListHeaderComponent={header}
      ListEmptyComponent={<View style={styles.state}><Text style={[styles.stateText, { color: theme.colors.textWeak }]}>{indexLoading ? de.lernen.searchIndexLoading : de.lernen.searchNoResults}</Text></View>}
      contentContainerStyle={{ paddingHorizontal: theme.spacing.base, paddingBottom: bottomInset, flexGrow: 1 }}
      initialNumToRender={12} windowSize={7}
    /> : <FlatList<ModuleListEntry>
      data={moduleList}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ModuleCard module={item} onPress={() => router.push(`/module/${item.id}`)} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState Icon={BookOpen} title={de.lernen.emptyTitle} body={de.lernen.emptyBody} />}
      contentContainerStyle={{ paddingHorizontal: theme.spacing.base, paddingBottom: bottomInset, flexGrow: 1 }}
      initialNumToRender={10} windowSize={7}
    />}
  </SafeAreaView>;
}

function StatusBanner({ text, color }: { text: string; color: string }) {
  const theme = useTheme();
  return <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: color, marginTop: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.sm }]}><Text style={[styles.bannerText, { color }]}>{text}</Text></View>;
}
function formatDate(iso: string | null): string {
  if (!iso) return '–';
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  stateText: { textAlign: 'center', fontSize: 16, lineHeight: 24 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 16 },
  indexLoading: { padding: 8, fontSize: 13 },
  searchResult: { borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 8 },
  resultTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  resultMeta: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  banner: { borderWidth: 1 },
  bannerText: { fontSize: 14, lineHeight: 20 },
  errorWrap: { alignItems: 'flex-start' },
});
