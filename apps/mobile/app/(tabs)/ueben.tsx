import { SafeAreaView, StyleSheet } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Reiter Üben: in Phase 3 nur Leerzustand. Tagesration und Quiz baut Agent D
// in AP-3.5.
export default function UebenScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState Icon={Dumbbell} title={de.ueben.emptyTitle} body={de.ueben.emptyBody} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
