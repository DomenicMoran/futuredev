import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../src/theme/useTheme.js';
import { de } from '../../src/i18n/de.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { useOnboardingStore } from '../../src/state/onboarding.js';
import { wipeAllTables } from '../../src/settings/db.js';
import { exportAll, importAll } from '../../src/data/exportImport.js';
import type { ReviewIntensity } from '../../src/settings/types.js';

const DAILY_GOAL_OPTIONS = [10, 20, 40, 60, 90];
const QUIZ_LENGTH_OPTIONS = [10, 15, 20];
const REVIEW_INTENSITY_OPTIONS: ReviewIntensity[] = ['leicht', 'normal', 'intensiv'];

// Route app/settings/index.tsx (AP-3.5, Punkt 4). Alle Werte liegen in der
// Tabelle `settings`, geschrieben über src/state/settings.ts und
// src/settings/persist.ts.
export default function SettingsScreen() {
  const theme = useTheme();
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const setDailyGoalMinutes = useSettingsStore((s) => s.setDailyGoalMinutes);
  const firstFormPreference = useSettingsStore((s) => s.firstFormPreference);
  const setFirstFormPreference = useSettingsStore((s) => s.setFirstFormPreference);
  const quizLength = useSettingsStore((s) => s.quizLength);
  const setQuizLength = useSettingsStore((s) => s.setQuizLength);
  const reviewIntensity = useSettingsStore((s) => s.reviewIntensity);
  const setReviewIntensity = useSettingsStore((s) => s.setReviewIntensity);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const setColorScheme = useSettingsStore((s) => s.setColorScheme);
  const telemetryEnabled = useSettingsStore((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useSettingsStore((s) => s.setTelemetryEnabled);
  const [status, setStatus] = useState<string | null>(null);

  async function handleExport() {
    try {
      const bundle = await exportAll();
      const path = `${FileSystem.cacheDirectory}futuredev-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(bundle, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
      }
      setStatus(de.settings.exportSuccess);
    } catch {
      setStatus(de.settings.exportError);
    }
  }

  async function handleImport() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (picked.canceled || !picked.assets?.[0]) return;
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const incoming: unknown = JSON.parse(raw);
      await importAll(incoming);
      setStatus(de.settings.importSuccess);
    } catch {
      setStatus(de.settings.importError);
    }
  }

  function handleResetOnboarding() {
    Alert.alert(de.settings.resetOnboardingConfirmTitle, de.settings.resetOnboardingConfirmBody, [
      { text: de.settings.resetOnboardingConfirmNo, style: 'cancel' },
      {
        text: de.settings.resetOnboardingConfirmYes,
        onPress: () => {
          useOnboardingStore.getState().reset();
          router.replace('/onboarding');
        },
      },
    ]);
  }

  function handleDeleteAll() {
    Alert.alert(de.settings.deleteAllConfirmTitle, de.settings.deleteAllConfirmBody, [
      { text: de.settings.deleteAllConfirmNo, style: 'cancel' },
      {
        text: de.settings.deleteAllConfirmYes,
        style: 'destructive',
        onPress: async () => {
          await wipeAllTables();
          useOnboardingStore.getState().applyHydrated(false, null);
          router.replace('/onboarding');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.base }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={de.common.back}
          hitSlop={12}
          style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}
        >
          <ChevronLeft color={theme.colors.text} size={26} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{de.settings.title}</Text>
        <View style={{ width: theme.minTapTarget }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>

      <OptionGroup theme={theme} title={de.settings.dailyGoalTitle}>
        {DAILY_GOAL_OPTIONS.map((minutes) => (
          <ChoicePill
            key={minutes}
            theme={theme}
            label={de.settings.dailyGoalOption(minutes)}
            active={dailyGoalMinutes === minutes}
            onPress={() => setDailyGoalMinutes(minutes)}
          />
        ))}
      </OptionGroup>

      <OptionGroup theme={theme} title={de.settings.firstFormTitle}>
        <ChoicePill theme={theme} label={de.settings.firstFormRead} active={firstFormPreference === 'read'} onPress={() => setFirstFormPreference('read')} />
        <ChoicePill theme={theme} label={de.settings.firstFormListen} active={firstFormPreference === 'listen'} onPress={() => setFirstFormPreference('listen')} />
      </OptionGroup>

      <OptionGroup theme={theme} title={de.settings.quizLengthTitle}>
        {QUIZ_LENGTH_OPTIONS.map((n) => (
          <ChoicePill key={n} theme={theme} label={String(n)} active={quizLength === n} onPress={() => setQuizLength(n)} />
        ))}
      </OptionGroup>

      <OptionGroup theme={theme} title={de.settings.reviewIntensityTitle}>
        {REVIEW_INTENSITY_OPTIONS.map((option) => (
          <ChoicePill
            key={option}
            theme={theme}
            label={
              option === 'leicht' ? de.settings.reviewIntensityLight : option === 'intensiv' ? de.settings.reviewIntensityIntense : de.settings.reviewIntensityNormal
            }
            active={reviewIntensity === option}
            onPress={() => setReviewIntensity(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup theme={theme} title={de.settings.colorSchemeTitle}>
        <ChoicePill theme={theme} label={de.settings.colorSchemeSystem} active={colorScheme === 'system'} onPress={() => setColorScheme('system')} />
        <ChoicePill theme={theme} label={de.settings.colorSchemeLight} active={colorScheme === 'light'} onPress={() => setColorScheme('light')} />
        <ChoicePill theme={theme} label={de.settings.colorSchemeDark} active={colorScheme === 'dark'} onPress={() => setColorScheme('dark')} />
      </OptionGroup>

      <SwitchRow theme={theme} title={de.settings.notificationsTitle} body={de.settings.notificationsBody} value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
      <SwitchRow theme={theme} title={de.settings.telemetryTitle} body={de.settings.telemetryBody} value={telemetryEnabled} onValueChange={setTelemetryEnabled} />

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{de.settings.exportTitle}</Text>
        <ActionButton theme={theme} label={de.settings.exportAction} onPress={handleExport} />
        <Text style={[styles.groupTitle, { color: theme.colors.text, marginTop: theme.spacing.base }]}>{de.settings.importTitle}</Text>
        <ActionButton theme={theme} label={de.settings.importAction} onPress={handleImport} />
        {status ? <Text style={[styles.status, { color: theme.colors.textWeak }]}>{status}</Text> : null}
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{de.settings.resetOnboardingTitle}</Text>
        <ActionButton theme={theme} label={de.settings.resetOnboardingAction} onPress={handleResetOnboarding} />
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text style={[styles.groupTitle, { color: theme.colors.error }]}>{de.settings.deleteAllTitle}</Text>
        <ActionButton theme={theme} label={de.settings.deleteAllAction} onPress={handleDeleteAll} destructive />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionGroup({ theme, title, children }: { theme: ReturnType<typeof useTheme>; title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>{children}</View>
    </View>
  );
}

function ChoicePill({ theme, label, active, onPress }: { theme: ReturnType<typeof useTheme>; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.colors.accent : theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.full,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <Text style={{ color: active ? theme.colors.accentText : theme.colors.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

function SwitchRow({
  theme,
  title,
  body,
  value,
  onValueChange,
}: {
  theme: ReturnType<typeof useTheme>;
  title: string;
  body: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.switchRow, { marginTop: theme.spacing.lg }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.status, { color: theme.colors.textWeak }]}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

function ActionButton({ theme, label, onPress, destructive }: { theme: ReturnType<typeof useTheme>; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: destructive ? theme.colors.error : theme.colors.accent,
          borderRadius: theme.radius.md,
          marginTop: theme.spacing.sm,
          minHeight: theme.minTapTarget,
        },
      ]}
    >
      <Text style={{ color: theme.colors.accentText, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  groupTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  pill: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { justifyContent: 'center', alignItems: 'center' },
  status: { fontSize: 13, lineHeight: 18, marginTop: 8 },
});
