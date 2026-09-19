import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { Scale } from 'lucide-react-native';
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

// Route app/legal/[page].tsx (AP-3.5, Punkt 3): Impressum, Datenschutz,
// Lizenzen, Über. Echte, kurze Entwürfe aus src/legal/de.ts, mit sichtbarem
// Hinweis "Entwurf, rechtliche Prüfung vor dem Release" auf jeder Seite.
export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const theme = useTheme();

  const key = (page && page in PAGES ? page : null) as LegalPage | null;

  if (!key) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={Scale} title={de.legal.title} body={de.legal.draftNotice} />
      </View>
    );
  }

  const content = PAGES[key];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.bg }]} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{content.title}</Text>
      <Text style={[styles.draftNotice, { color: theme.colors.warning, marginTop: theme.spacing.xs }]}>
        {de.legal.draftNotice}
      </Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  draftNotice: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  licenseRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  licenseMeta: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
