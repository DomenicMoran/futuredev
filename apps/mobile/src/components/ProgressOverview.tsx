import { Text, View } from 'react-native';
import { useContent } from '../content/ContentProvider.js';
import { EMPTY_LESSON_STATUS } from '../data/lessonStatus.js';
import { useTheme } from '../theme/useTheme.js';
export function ProgressOverview({ lessonIds }: { lessonIds?: readonly string[] }) {
  const theme = useTheme();
  const { moduleList, statuses } = useContent();
  const ids = lessonIds ?? moduleList.flatMap(module => module.subModules.flatMap(sub => sub.lessons.map(lesson => lesson.id)));
  const values = ids.map(id => statuses[id] ?? EMPTY_LESSON_STATUS);
  const touched = values.filter(status => status.read || status.heard || status.done).length;
  return <View testID="progress-overview" style={{ padding: 16, gap: 12, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border }}>
    <Text accessibilityRole="header" style={{ fontWeight: '700', fontSize: 17, color: theme.colors.text }}>Dein Überblick</Text>
    <Text style={{ color: theme.colors.textWeak }}>{touched} von {ids.length} Lektionen gelesen, gehört oder erledigt</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Bearbeitete Lektionen" accessibilityValue={{ min: 0, max: ids.length || 1, now: touched }} style={{ height: 5, backgroundColor: theme.colors.border, borderRadius: 3 }}><View style={{ height: 5, borderRadius: 3, width: `${ids.length ? touched / ids.length * 100 : 0}%`, backgroundColor: theme.colors.accent }} /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{([['read', 'Gelesen'], ['heard', 'Gehört'], ['done', 'Erledigt'], ['quizPassed', 'Quiz bestanden']] as const).map(([key, label]) => <View key={key} style={{ minWidth: '38%', flexGrow: 1 }}><Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 22 }}>{values.filter(status => status[key]).length}</Text><Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{label}</Text></View>)}</View>
  </View>;
}
