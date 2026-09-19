import { SafeAreaView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Reiter Lernen: in Phase 3 nur Leerzustand und Navigation, Modul- und
// Lektionsliste (aus content/modules.json und dem Manifest) baut Agent B in
// AP-3.3.
export default function LernenScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState
        Icon={BookOpen}
        title={de.lernen.emptyTitle}
        body={de.lernen.emptyBody}
        actionLabel={de.lernen.emptyAction}
        onAction={() => router.push('/lesson/M01-01-01')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
