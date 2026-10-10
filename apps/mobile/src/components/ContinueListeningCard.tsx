import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Headphones, Play } from 'lucide-react-native';
import { router } from 'expo-router';
import { useContent } from '../content/ContentProvider.js';
import { useTheme } from '../theme/useTheme.js';
import { usePlayerStore } from '../player/store.js';
import { resumeLessonInModuleContext } from '../player/index.js';
import { resolveListeningContinuation, shouldResumeLiveListening, remainingListeningMinutes } from '../player/listeningContinuation.js';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function ContinueListeningCard() {
  const theme = useTheme();
  const { moduleList, statuses } = useContent();
  const live = usePlayerStore(state => state.queue.items[state.queue.currentIndex]);
  const liveSeconds = usePlayerStore(state => Math.floor(state.positionSeconds));
  const autoplay = usePlayerStore(state => state.autoplayNext);
  const playing = usePlayerStore(state => state.isPlaying);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lessons = moduleList.flatMap(module => module.subModules.flatMap(sub => sub.lessons));
  const target = live && shouldResumeLiveListening(statuses[live.lessonId], liveSeconds, live.durationSeconds, playing) ? { lesson: { id: live.lessonId, title: live.title, durationMinutes: live.durationSeconds / 60, durationSeconds: live.durationSeconds }, seconds: liveSeconds, next: false } : resolveListeningContinuation(lessons, statuses);
  if (!target) return null;
  async function start() {
    if (!target || busy) return;
    setBusy(true); setError(false);
    try { await resumeLessonInModuleContext(target.lesson.id, target.seconds); router.push('/player'); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  const label = playing && live ? 'Zum laufenden Audio' : target.seconds > 0 ? 'Jetzt weiterhören' : target.next ? 'Nächste Lektion hören' : 'Jetzt hören';
  return <View style={{ marginBottom: 12, padding: 18, gap: 8, backgroundColor: theme.colors.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.accent }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Headphones size={18} color={theme.colors.accent} /><Text style={{ color: theme.colors.accent, fontWeight: '600' }}>{target.next ? 'Als Nächstes' : 'Dein Hörplatz'}</Text></View>
    <Text style={{ fontWeight: '700', fontSize: 19, lineHeight: 26, color: theme.colors.text }}>{target.lesson.title}</Text>
    <Text style={{ color: theme.colors.textWeak }}>{target.seconds > 0 ? `Fortsetzen ab ${clock(target.seconds)} · ca. ${remainingListeningMinutes(target.lesson, target.seconds, statuses[target.lesson.id])} Min. verbleibend` : autoplay ? 'Danach geht es automatisch mit der nächsten Lektion im Modul weiter.' : 'Automatisches Weiterhören ist ausgeschaltet.'}</Text>
    <Pressable testID="continue-listening" disabled={busy} accessibilityState={{ disabled: busy }} accessibilityRole="button" accessibilityLabel={`${label}: ${target.lesson.title}`} onPress={() => void start()} style={{ minHeight: 50, borderRadius: 12, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 }}><Play size={18} color={theme.colors.bg} /><Text style={{ color: theme.colors.bg, fontWeight: '700', fontSize: 16 }}>{busy ? 'Wird geöffnet …' : label}</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>Audio konnte nicht gestartet werden. Verbindung oder Offline-Download prüfen und erneut versuchen.</Text> : null}
  </View>;
}
