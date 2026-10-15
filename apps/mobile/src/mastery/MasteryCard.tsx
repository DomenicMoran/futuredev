import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../theme/useTheme.js';
export function MasteryCard() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lernkreislauf öffnen"
      onPress={() => router.push('/mastery')}
      style={{
        padding: 18,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        minHeight: theme.minTapTarget,
      }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
          DEIN LERNKREISLAUF
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: 20, lineHeight: 27, fontWeight: '700' }}>
          Was ist wirklich hängen geblieben?
        </Text>
        <Text style={{ color: theme.colors.textWeak, fontSize: 15, lineHeight: 22 }}>
          Alles prüfen. Wissenslücken gezielt hören oder lesen. Erneut prüfen – bis alle Fragen
          richtig sind.
        </Text>
        <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '600' }}>
          Prüfung & Wiederholung öffnen →
        </Text>
      </View>
    </Pressable>
  );
}
