import { useMemo } from 'react';

import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import { ArrowLeft, BookOpen } from 'lucide-react-native';

import { useTheme } from '../../src/theme/useTheme';

import { EmptyState } from '../../src/components/EmptyState';

import { ModuleCover } from '../../src/components/ModuleCover';

import { LessonRow } from '../../src/components/LessonRow';

import { ProgressBar } from '../../src/components/ProgressBar';

import { de } from '../../src/i18n/de';

import { useContent } from '../../src/content/ContentProvider';

import type { LessonListEntry } from '../../src/content/listLessons';

import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset';



interface Section {

  title: string;

  data: LessonListEntry[];

};



export default function ModuleScreen() {

  const { id } = useLocalSearchParams<{ id: string }>();

  const theme = useTheme();

  const bottomInset = useBottomChromeInset();

  const { moduleList } = useContent();

  const module = moduleList.find((m) => m.id === id);



  const sections = useMemo((): Section[] => {

    if (!module) return [];

    return module.subModules

      .filter((sub) => sub.lessons.length > 0)

      .map((sub) => ({ title: sub.title, data: sub.lessons }));

  }, [module]);



  const progress = module && module.totalLessons > 0 ? module.completedLessons / module.totalLessons : 0;



  return (

    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>

      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.base,
            paddingBottom: theme.spacing.sm,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >

        <Pressable

          onPress={() => router.back()}

          accessibilityRole="button"

          accessibilityLabel={de.module.backToModules}

          style={[styles.backButton, { minHeight: theme.minTapTarget }]}

        >

          <ArrowLeft size={22} color={theme.colors.text} />

          <Text style={[styles.backLabel, { color: theme.colors.text }]}>{de.module.backToModules}</Text>

        </Pressable>

        <View style={[styles.titleRow, { gap: theme.spacing.md, marginTop: theme.spacing.sm }]}>

          {module ? <ModuleCover moduleId={module.id} size={56} /> : null}

          <View style={styles.headerText}>

            <Text style={[styles.title, { color: theme.colors.text }]}>{module ? module.title : de.module.unknownTitle}</Text>

            {module && module.totalLessons > 0 ? (

              <Text style={[styles.progressMeta, { color: theme.colors.textWeak }]}>

                {de.lernen.lessonsProgress(module.completedLessons, module.totalLessons)}

              </Text>

            ) : null}

            {module && module.totalLessons > 0 ? <ProgressBar progress={progress} /> : null}

          </View>

        </View>

      </View>



      {!module || module.totalLessons === 0 ? (

        <EmptyState Icon={BookOpen} title={de.lernen.inPreparation} body={de.module.emptyNoLessons} />

      ) : (

        <SectionList

          sections={sections}

          keyExtractor={(lesson) => lesson.id}

          stickySectionHeadersEnabled

          contentContainerStyle={{ paddingHorizontal: theme.spacing.base, paddingBottom: bottomInset }}

          renderSectionHeader={({ section }) => (

            <View style={[styles.sectionHeader, { backgroundColor: theme.colors.bg, paddingTop: theme.spacing.md }]}>

              <Text style={[styles.subModuleTitle, { color: theme.colors.textWeak }]}>{section.title}</Text>

            </View>

          )}

          renderItem={({ item }) => (

            <LessonRow lesson={item} onPress={() => router.push(`/lesson/${item.id}`)} />

          )}

        />

      )}

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1 },

  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8 },

  backLabel: { fontSize: 16, lineHeight: 22 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },

  headerText: { flex: 1, gap: 6, paddingBottom: 8 },

  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' },

  progressMeta: { fontSize: 13, lineHeight: 18 },

  sectionHeader: {},

  subModuleTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

});

