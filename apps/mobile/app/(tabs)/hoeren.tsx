import { SafeAreaView, StyleSheet } from 'react-native';
import { Headphones } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Reiter Hören: in Phase 3 nur Leerzustand. Player, Mini-Player und
// Warteschlange baut Agent C in AP-3.4.
export default function HoerenScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState Icon={Headphones} title={de.hoeren.emptyTitle} body={de.hoeren.emptyBody} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
