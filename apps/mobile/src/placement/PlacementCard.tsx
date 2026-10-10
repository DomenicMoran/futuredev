import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/useTheme.js';
import { loadPlacement } from './persistence.js';
import { assess, type PlacementResult } from './assessment.js';
export function PlacementCard() {
  const theme = useTheme();
  const [result, setResult] = useState<PlacementResult | null>(null);
  useFocusEffect(useCallback(() => { let active = true; void loadPlacement().then(r => { if (active) setResult(r); }).catch(() => { if (active) setResult(null); }); return () => { active = false; }; }, []));
  const known = result ? assess(result.answers).filter(t => t.known).length : 0;
  return <Pressable testID="placement-open" accessibilityRole="button" onPress={() => router.push('/placement')} style={{ padding: 16, marginBottom: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, minHeight: theme.minTapTarget }}><View style={{ gap: 6 }}><Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 17 }}>Dein Grundlagen-Check</Text><Text style={{ color: theme.colors.textWeak, lineHeight: 21 }}>{result ? `${known} Grundlagenbereiche mit Vorkenntnissen · ${result.skipKnown ? 'Bekannte Bereiche beim Einstieg auslassen' : 'Alle Grundlagen im Einstieg'}. Ergebnis und Einstieg öffnen →` : 'Schon Vorkenntnisse? Optional 14 Fragen beantworten und bekannte Grundlagen beim Einstieg auslassen →'}</Text></View></Pressable>;
}
