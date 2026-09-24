import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MessageCircleQuestion } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { listPublishedPortfolioItems, type PublishedPortfolioItem } from '../../src/explain/publishedPortfolio.js';

export default function ErklaerIndexScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<PublishedPortfolioItem[] | null>(null);

  const refresh = useCallback(() => {
    listPublishedPortfolioItems()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useFocusEffect(refresh);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de.erklaer.back}
          onPress={() => router.back()}
          style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}
        >
          <Text style={[styles.backLabel, { color: theme.colors.accent }]}>{de.erklaer.back}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text, marginTop: theme.spacing.xs }]}>{de.erklaer.title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
          {de.erklaer.listSubtitle}
        </Text>
      </View>

      {items === null ? (
        <EmptyState Icon={MessageCircleQuestion} title={de.erklaer.loadingTitle} body={de.erklaer.loadingBody} />
      ) : items.length === 0 ? (
        <EmptyState
          Icon={MessageCircleQuestion}
          title={de.erklaer.emptyTitle}
          body={de.erklaer.emptyBody}
          actionLabel={de.erklaer.emptyAction}
          onAction={() => router.push('/(tabs)/ich')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${de.erklaer.openBaustein} ${item.title}`}
              onPress={() => router.push(`/erklaer/${item.id}`)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.base,
                  minHeight: theme.minTapTarget,
                },
              ]}
            >
              <Text style={[styles.cardId, { color: theme.colors.textWeak }]}>{item.id}</Text>
              <Text style={[styles.cardTitle, { color: theme.colors.text, marginTop: theme.spacing.xs }]}>
                {item.title}
              </Text>
              <Text style={[styles.cardGoal, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                {item.goal}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  backLabel: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardId: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  cardGoal: { fontSize: 14, lineHeight: 20 },
});
