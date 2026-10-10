import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, CheckCircle2, X } from 'lucide-react-native';
import { useContent } from '../content/ContentProvider.js';
import { EMPTY_LESSON_STATUS, lessonStatusLabel, setLessonStatus, undoLessonStatus, type StatusKind, type StatusChange } from '../data/lessonStatus.js';
import { useTheme } from '../theme/useTheme.js';

export function LessonStatusActions({ lessonId, title, compact = false, label, onOpenChange }: { lessonId: string; title: string; compact?: boolean; label?: string; onOpenChange?: (open: boolean) => void }) {
  const theme = useTheme();
  const { statuses, refreshStatuses } = useContent();
  const status = statuses[lessonId] ?? EMPTY_LESSON_STATUS;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange?.(next); };
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<StatusChange | null>(null);
  async function change(kind: StatusKind, value: boolean | undefined) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await setLessonStatus(lessonId, kind, value); setUndo(result); await refreshStatuses(); }
    catch { setError('Markierung konnte nicht gespeichert werden. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }
  async function revert() {
    if (!undo || busy) return;
    setBusy(true); setError('');
    try { await undoLessonStatus(lessonId, undo); setUndo(null); await refreshStatuses(); }
    catch { setError('Rückgängig nicht möglich. Bitte den aktuellen Status erneut bearbeiten.'); }
    finally { setBusy(false); }
  }
  const buttonStyle = { minHeight: 48, justifyContent: 'center' as const, paddingHorizontal: 12 };
  return <>
    <Pressable testID={`lesson-status-${lessonId}`} accessibilityRole="button" accessibilityLabel={`Lernstatus bearbeiten: ${title}`} onPress={() => changeOpen(true)} style={buttonStyle}>
      {compact ? <CheckCircle2 size={22} color={theme.colors.accent} /> : <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>{label ?? `${lessonStatusLabel(status)} · Bearbeiten`}</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => changeOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
        <View accessibilityViewIsModal style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', padding: 20, paddingBottom: 32 }}>
          <ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text accessibilityRole="header" style={{ flex: 1, color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>Dein Lernstatus</Text><Pressable onPress={() => changeOpen(false)} accessibilityRole="button" accessibilityLabel="Schließen" style={buttonStyle}><X color={theme.colors.text} size={24} /></Pressable></View>
            <Text style={{ color: theme.colors.text, marginVertical: 8 }}>{title}</Text>
            <Text style={{ color: theme.colors.textWeak, marginBottom: 16 }}>Deine Markierungen ändern weder Quiz-Ergebnisse noch gemessene Hörzeit. Du kannst sie jederzeit zurücknehmen.</Text>
            {([['read', 'Gelesen', 'ungelesen'], ['heard', 'Gehört', 'ungehört'], ['done', 'Erledigt', 'offen']] as const).map(([kind, label, reverse]) => <View key={kind} style={{ borderTopWidth: 0.5, borderColor: theme.colors.border }}>
              <Pressable testID={`mark-${kind}`} disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: status[kind], disabled: busy }} accessibilityLabel={status[kind] ? `Als ${reverse} markieren` : `Als ${label.toLowerCase()} markieren`} onPress={() => void change(kind, !status[kind])} style={[buttonStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }]}>
                <Text style={{ color: theme.colors.text, fontSize: 16 }}>{status[kind] ? `Als ${reverse} markieren` : `Als ${label.toLowerCase()} markieren`}</Text>{status[kind] ? <Check size={20} color={theme.colors.success} /> : null}
              </Pressable>
              {status.overrides[kind] !== undefined ? <Pressable disabled={busy} accessibilityState={{ disabled: busy }} accessibilityRole="button" onPress={() => void change(kind, undefined)} style={buttonStyle}><Text style={{ color: theme.colors.textWeak, fontSize: 13 }}>{label}: automatisch ermitteln</Text></Pressable> : null}
            </View>)}
            {undo ? <View accessibilityLiveRegion="polite" style={{ marginTop: 12, borderRadius: 12, backgroundColor: theme.colors.bg, padding: 8 }}><Text style={{ color: theme.colors.text }}>Markierung gespeichert</Text><Pressable testID="status-undo" disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} onPress={() => void revert()} style={buttonStyle}><Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Rückgängig</Text></Pressable></View> : null}
            {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
