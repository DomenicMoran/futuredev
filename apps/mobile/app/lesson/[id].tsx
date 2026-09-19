import { SafeAreaView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';

// Minimale, ehrliche Ansicht "Lektion wird geladen". Zeigt die angefragte
// Lektionskennung, lädt aber noch keinen Inhalt: Agent B ersetzt diese Datei
// durch den vollständigen Lektionsbildschirm (Lesen, Hören, Quiz,
// Praxisaufgabe) in AP-3.3.
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <EmptyState Icon={BookOpen} title={`${de.lesson.loadingTitle} (${id})`} body={de.lesson.loadingBody} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
