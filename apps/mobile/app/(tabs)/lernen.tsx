import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { BookOpen } from 'lucide-react-native';

import { useTheme } from '../../src/theme/useTheme';

import { EmptyState } from '../../src/components/EmptyState';

import { ModuleCard } from '../../src/components/ModuleCard';

import { de } from '../../src/i18n/de';

import { useContent } from '../../src/content/ContentProvider';

import type { ModuleListEntry } from '../../src/content/listLessons';

import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset';
import { openFirstPublishedLessonOrLernen } from '../../src/navigation/openFirstLesson.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';



export default function LernenScreen() {

  const theme = useTheme();

  const { state, moduleList, refresh } = useContent();

  const bottomInset = useBottomChromeInset();



  const isLoading = moduleList.length === 0 && state.status === 'ok' && !state.manifest;



  const renderItem = ({ item }: { item: ModuleListEntry }) => (

    <ModuleCard module={item} onPress={() => router.push(`/module/${item.id}`)} />

  );



  return (

    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>

      {state.status === 'offline' ? (

        <StatusBanner

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

          <StatusBanner text={`${de.lernen.errorBanner} ${de.lernen.retry}`} color={theme.colors.error} bg={theme.colors.surface} />

        </Pressable>

      ) : null}

      {state.status === 'ok' && state.hasNewLessons ? (

        <StatusBanner text={de.lernen.newLessonsBanner} color={theme.colors.accent} bg={theme.colors.surface} />

      ) : null}



      {isLoading ? (

        <EmptyState

          Icon={BookOpen}

          title={de.lernen.emptyTitle}

          body={de.lernen.emptyBody}

          actionLabel={de.lernen.emptyAction}

          onAction={() => openFirstPublishedLessonOrLernen(moduleList)}

        />

      ) : (

        <FlatList

          data={moduleList}

          keyExtractor={(item) => item.id}

          renderItem={renderItem}

          ListHeaderComponent={<TabScreenTitle title={de.lernen.title} />}

          contentContainerStyle={{ paddingBottom: bottomInset }}

          initialNumToRender={10}

          windowSize={5}

        />

      )}

    </SafeAreaView>

  );

}



function StatusBanner({ text, color, bg }: { text: string; color: string; bg: string }) {

  const theme = useTheme();

  return (

    <View

      style={[

        styles.banner,

        {

          backgroundColor: bg,

          borderColor: color,

          marginHorizontal: theme.spacing.base,

          marginTop: theme.spacing.sm,

          paddingHorizontal: theme.spacing.md,

          paddingVertical: theme.spacing.sm,

          borderRadius: theme.radius.sm,

        },

      ]}

    >

      <Text style={[styles.bannerText, { color, fontSize: theme.type.size.sm.size, lineHeight: theme.type.size.sm.lineHeight }]}>

        {text}

      </Text>

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

    borderWidth: 1,

  },

  bannerText: {},

});


