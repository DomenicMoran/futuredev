import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, Lock } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { EmptyState } from '../../src/components/EmptyState';
import { de } from '../../src/i18n/de';
import { useContent } from '../../src/content/ContentProvider';
import type { ModuleListEntry } from '../../src/content/listLessons';

// Reiter Lernen: Module M01 bis M10 aus content/modules.json, mit
// Fortschrittsbalken aus SQLite. Ersetzt den vorherigen Dauer-Leerzustand
// ("Der Lehrplan wird geladen" blieb bislang für immer stehen, weil dieser
// Bildschirm nie Inhalte lud), siehe ux-bildschirmfluss.md Abschnitt 2.
export default function LernenScreen() {
  const theme = useTheme();
  const { state, moduleList, refresh } = useContent();

  const isLoading = moduleList.length === 0 && state.status === 'ok' && !state.manifest;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {state.status === 'offline' ? (
        <Banner
          text={`${de.lernen.offlineBanner} ${formatDate(state.lastUpdatedAt)}`}
          color={theme.colors.warning}
          bg={theme.colors.surface}
        />
      ) : null}
      {state.status === 'error' ? (
        <Pressable
          onPress={() => void refresh()}
          accessibilityRole="button"
          accessibilityLabel={`${de.lernen.errorBanner} ${de.lernen.retry}`}
        >
          <Banner text={`${de.lernen.errorBanner} ${de.lernen.retry}`} color={theme.colors.error} bg={theme.colors.surface} />
        </Pressable>
      ) : null}
      {state.status === 'ok' && state.hasNewLessons ? (
        <Banner text={de.lernen.newLessonsBanner} color={theme.colors.accent} bg={theme.colors.surface} />
      ) : null}

      {isLoading ? (
        <EmptyState
          Icon={BookOpen}
          title={de.lernen.emptyTitle}
          body={de.lernen.emptyBody}
          actionLabel={de.lernen.emptyAction}
          onAction={() => router.push('/lesson/M01-01-01')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.base }}>
          {moduleList.map((module) => (
            <ModuleRow key={module.id} module={module} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ModuleRow({ module }: { module: ModuleListEntry }) {
  const theme = useTheme();
  const hasLessons = module.totalLessons > 0;

  return (
    <Pressable
      onPress={() => router.push(`/module/${module.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${module.id}: ${module.title}`}
      style={[
        styles.moduleRow,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          padding: theme.spacing.base,
          marginBottom: theme.spacing.sm,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <View style={styles.moduleRowText}>
        <Text style={[styles.moduleId, { color: theme.colors.textWeak }]}>{module.id}</Text>
        <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{module.title}</Text>
        <Text style={[styles.moduleMeta, { color: theme.colors.textWeak }]}>
          {hasLessons
            ? de.lernen.lessonsProgress(module.completedLessons, module.totalLessons)
            : `${de.lernen.inPreparation}, ${de.lernen.plannedLessons(module.subModules.length)}`}
        </Text>
        {hasLessons ? (
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.accent,
                  width: `${module.totalLessons === 0 ? 0 : (module.completedLessons / module.totalLessons) * 100}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
      {hasLessons ? (
        <ChevronRight size={20} color={theme.colors.textWeak} />
      ) : (
        <Lock size={18} color={theme.colors.textWeak} accessibilityLabel={de.lernen.inPreparation} />
      )}
    </Pressable>
  );
}

function Banner({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  moduleRowText: {
    flex: 1,
    marginRight: 12,
  },
  moduleId: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  moduleTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 2,
  },
  moduleMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
});
