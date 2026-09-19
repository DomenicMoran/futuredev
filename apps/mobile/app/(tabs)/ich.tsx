import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { CircleUser } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Reiter Ich: in Phase 3 nur Leerzustand. Fortschritt, Jobreife, Portfolio,
// Einstellungen, Export/Import baut Agent D in AP-3.5.
export default function IchScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState Icon={CircleUser} title={de.ich.emptyTitle} body={de.ich.emptyBody} />
      <View style={[styles.disclaimer, { padding: theme.spacing.base }]}>
        <Text style={[styles.disclaimerText, { color: theme.colors.textWeak }]}>
          {de.ich.readinessDisclaimer}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disclaimer: {
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
