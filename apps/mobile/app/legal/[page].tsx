import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { ChevronLeft, Scale } from 'lucide-react-native';
import { de } from '../../src/i18n/de.js';
import { legal } from '../../src/legal/de.js';
import licenses from '../../src/legal/licenses.json';

type LegalPage = 'imprint' | 'privacy' | 'licenses' | 'about';

const PAGES: Record<LegalPage, { title: string; body: readonly string[] }> = {
  imprint: legal.imprint,
  privacy: legal.privacy,
  licenses: legal.licenses,
  about: legal.about,
};

const showLegalDraftBanner = __DEV__ || process.env.EXPO_PUBLIC_LEGAL_DRAFT === '1';

// Route app/legal/[page].tsx (AP-3.5, Punkt 3): Impressum, Datenschutz,
// Lizenzen, Über. Echte, kurze Entwürfe aus src/legal/de.ts; Entwurf-Hinweis
// nur in Dev oder mit EXPO_PUBLIC_LEGAL_DRAFT=1.
export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const theme = useTheme();

  const key = (page && page in PAGES ? page : null) as LegalPage | null;

  if (!key) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <LegalHeader title={de.legal.title} theme={theme} />
        <EmptyState Icon={Scale} title={de.legal.title} body={de.legal.notFoundBody} />
      </SafeAreaView>
    );
  }

  const content = PAGES[key];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <LegalHeader title={content.title} theme={theme} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{content.title}</Text>
      {showLegalDraftBanner ? (
        <Text style={[styles.draftNotice, { color: theme.colors.warning, marginTop: theme.spacing.xs }]}>
          {de.legal.draftNotice}
        </Text>
      ) : null}
      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.base }}>
        {content.body.map((paragraph) => (
          <Text key={paragraph} style={[styles.body, { color: theme.colors.text }]}>
            {paragraph}
          </Text>
        ))}
      </View>
      {key === 'licenses' ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          {licenses.packages.map((pkg) => (
            <View key={pkg.name} style={[styles.licenseRow, { borderColor: theme.colors.border }]}>
              <Text style={[styles.body, { color: theme.colors.text }]}>{pkg.name}</Text>
              <Text style={[styles.licenseMeta, { color: theme.colors.textWeak }]}>
                {pkg.version} · {pkg.license}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalHeader({ title, theme }: { title: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.header, { paddingHorizontal: theme.spacing.base }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={de.common.back}
        hitSlop={12}
        style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}
      >
        <ChevronLeft color={theme.colors.text} size={26} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: theme.minTapTarget }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  draftNotice: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  licenseRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  licenseMeta: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
