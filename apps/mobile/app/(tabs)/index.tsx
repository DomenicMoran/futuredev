import { SafeAreaView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Reiter Start: in Phase 3 nur der Leerzustand, weil noch kein Fortschritt
// existiert. Führt in die erste Lektion (M01-01-01), die Agent B füllt.
export default function StartScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState
        Icon={Sparkles}
        title={de.start.emptyTitle}
        body={de.start.emptyBody}
        actionLabel={de.start.emptyAction}
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
