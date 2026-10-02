import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { de } from '../../src/i18n/de.js';
import { loadProfileData, type BookmarkDisplayItem, type NoteDisplayItem, type ProfileData } from '../../src/settings/profile.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';

export default function ProfileListScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const isNotes = kind === 'notes';
  const theme = useTheme();
  const bottomInset = useBottomChromeInset();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadProfileData();
      setData(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE');
    const values = isNotes ? data?.notes ?? [] : data?.bookmarks ?? [];
    if (!normalized) return values;
    return values.filter((item) => {
      const haystack = isNotes
        ? (item as NoteDisplayItem).body
        : `${(item as BookmarkDisplayItem).lessonTitle} ${(item as BookmarkDisplayItem).lessonId}`;
      return haystack.toLocaleLowerCase('de-DE').includes(normalized);
    });
  }, [data, isNotes, query]);

  const title = isNotes ? de.ich.notesTitle : de.ich.bookmarksTitle;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.base, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="profile-list-back" accessibilityRole="button" accessibilityLabel={de.common.back} onPress={() => router.back()} style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}>
          <ChevronLeft color={theme.colors.text} size={24} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      </View>
      <View style={[styles.searchWrap, { paddingHorizontal: theme.spacing.base }]}>
        <Search color={theme.colors.textWeak} size={18} />
        <TextInput testID="profile-list-search" value={query} onChangeText={setQuery} placeholder={isNotes ? de.ich.searchNotes : de.ich.searchBookmarks} placeholderTextColor={theme.colors.textWeak} accessibilityLabel={isNotes ? de.ich.searchNotes : de.ich.searchBookmarks} returnKeyType="search" style={[styles.search, { color: theme.colors.text }]} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={de.ich.clearSearch} onPress={() => setQuery('')} style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.colors.accent }}>×</Text></Pressable> : null}
      </View>
      {loading && !data ? <View style={styles.state}><ActivityIndicator color={theme.colors.accent} /><Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ich.profileLoading}</Text></View> : null}
      {error ? <View accessibilityRole="alert" style={[styles.error, { paddingHorizontal: theme.spacing.base }]}><Text style={[styles.body, { color: theme.colors.error }]}>{de.ich.profileLoadError}</Text><Pressable testID="profile-list-retry" accessibilityRole="button" onPress={() => void refresh()} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={[styles.body, { color: theme.colors.accent }]}>{de.ich.retry}</Text></Pressable></View> : null}
      {data ? <FlatList
        data={rows as (NoteDisplayItem | BookmarkDisplayItem)[]}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.base, paddingBottom: bottomInset, flexGrow: rows.length === 0 ? 1 : undefined }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListEmptyComponent={<View style={styles.state}><Text style={[styles.body, { color: theme.colors.textWeak }]}>{query ? de.ich.searchNoResults : (isNotes ? de.ich.notesEmpty : de.ich.bookmarksEmpty)}</Text></View>}
        renderItem={({ item }) => isNotes ? (
          <Pressable accessibilityRole="button" accessibilityLabel={(item as NoteDisplayItem).body} onPress={() => router.push(`/lesson/${(item as NoteDisplayItem).lessonId}`)} style={[styles.row, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}>
            <Text style={[styles.body, { color: theme.colors.text }]}>{(item as NoteDisplayItem).body}</Text>
            <Text style={[styles.meta, { color: theme.colors.textWeak }]}>{(item as NoteDisplayItem).lessonId}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${(item as BookmarkDisplayItem).lessonTitle}, Block ${(item as BookmarkDisplayItem).position + 1}`} onPress={() => router.push(`/lesson/${(item as BookmarkDisplayItem).lessonId}?block=${(item as BookmarkDisplayItem).position}`)} style={[styles.row, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}>
            <Text style={[styles.body, { color: theme.colors.text }]}>{(item as BookmarkDisplayItem).lessonTitle} · Block {(item as BookmarkDisplayItem).position + 1}</Text>
          </Pressable>
        )}
      /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', marginLeft: 8 },
  searchWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#7774' },
  search: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 16 },
  state: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
  error: { paddingTop: 8 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  body: { fontSize: 16, lineHeight: 24 },
  meta: { fontSize: 12, lineHeight: 18 },
});
