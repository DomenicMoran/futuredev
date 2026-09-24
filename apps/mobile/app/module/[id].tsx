import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { ModuleCover } from '../../src/components/ModuleCover';
import { de } from '../../src/i18n/de';
import { useContent } from '../../src/content/ContentProvider';
import type { LessonListEntry } from '../../src/content/listLessons';
import { BookOpen } from 'lucide-react-native';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset';

// Untermodulliste eines Moduls mit Lektionen (Titel, Zustand-Marke). Nur
// veröffentlichte Lektionen erscheinen, siehe inhaltsformat.md "Wie die App
// mit einem Teilstand umgeht": kein Platzhalter für Unveröffentlichtes.
export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const bottomInset = useBottomChromeInset();
  const { moduleList } = useContent();
  const module = moduleList.find((m) => m.id === id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.base, paddingTop: theme.spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={de.module.backToModules}
          style={[styles.backButton, { minHeight: theme.minTapTarget }]}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
          <Text style={[styles.backLabel, { color: theme.colors.text }]}>{de.module.backToModules}</Text>
        </Pressable>
        <View style={styles.titleRow}>
          {module ? <ModuleCover moduleId={module.id} size={48} /> : null}
          <Text style={[styles.title, { color: theme.colors.text, flex: 1 }]}>
            {module ? module.title : id}
          </Text>
        </View>
      </View>

      {!module || module.totalLessons === 0 ? (
        <EmptyState Icon={BookOpen} title={de.lernen.inPreparation} body={de.module.emptyNoLessons} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.base, paddingBottom: bottomInset }}>
          {module.subModules
            .filter((sub) => sub.lessons.length > 0)
            .map((sub) => (
              <View key={sub.id} style={{ marginBottom: theme.spacing.lg }}>
                <Text style={[styles.subModuleTitle, { color: theme.colors.textWeak }]}>{sub.title}</Text>
                {sub.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LessonRow({ lesson }: { lesson: LessonListEntry }) {
  const theme = useTheme();
  const stateLabel = stateLabelFor(lesson.state);
  const isCompleted = lesson.state === 'completed';

  return (
    <Pressable
      onPress={() => router.push(`/lesson/${lesson.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}, ${stateLabel}`}
      style={[
        styles.lessonRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.base,
          marginTop: theme.spacing.sm,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      {isCompleted ? (
        <CheckCircle2 size={20} color={theme.colors.success} />
      ) : (
        <Circle size={20} color={theme.colors.textWeak} />
      )}
      <View style={styles.lessonRowText}>
        <Text style={[styles.lessonId, { color: theme.colors.text }]}>{lesson.title}</Text>
        <Text style={[styles.lessonState, { color: theme.colors.textWeak }]}>
          {lesson.durationMinutes > 0 ? de.module.lessonDuration(lesson.durationMinutes) : lesson.id}
          {' · '}
          {stateLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function stateLabelFor(state: LessonListEntry['state']): string {
  switch (state) {
    case 'new':
      return de.lernen.stateNew;
    case 'started':
      return de.lernen.stateStarted;
    case 'read':
      return de.lernen.stateRead;
    case 'listened':
      return de.lernen.stateListened;
    case 'quiz_passed':
      return de.lernen.stateQuizPassed;
    case 'completed':
      return de.lernen.stateCompleted;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { fontSize: 16, lineHeight: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  subModuleTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  lessonRowText: { flex: 1 },
  lessonId: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  lessonState: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
