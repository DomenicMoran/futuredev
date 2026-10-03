import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { exportAll } from '../../src/data/exportImport.js';
import { importExportJson, MAX_EXPORT_BYTES } from '../../src/settings/importExport.js';
import { clearPlayerAndDownloads } from '../../src/player/index.js';
import { cleanupPickedCacheAsset, cleanupPrivateExportCache } from '../../src/settings/privateCache.js';
import { deliverExport } from '../../src/settings/exportDelivery.js';
import { cleanupImportCopy, importThenHydrate } from '../../src/settings/importLifecycle.js';
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
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const setColorScheme = useSettingsStore((s) => s.setColorScheme);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hydrateRetryNeeded, setHydrateRetryNeeded] = useState(false);
  const operationInFlight = useRef(false);

  async function handleExport() {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setBusy('Export wird erstellt …');
    try {
      const bundle = await exportAll();
      const contents = JSON.stringify(bundle, null, 2);
      const delivery = await deliverExport(contents, {
        cacheDirectory: FileSystem.cacheDirectory ?? '',
        writeCache: (path, text) => FileSystem.writeAsStringAsync(path, text),
        isSharingAvailable: () => Sharing.isAvailableAsync(),
        share: async (path) => { await Sharing.shareAsync(path, { mimeType: 'application/json' }); return undefined; },
        requestDirectory: async () => {
          const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          return permission.granted ? { granted: true, directoryUri: permission.directoryUri } : { granted: false };
        },
        createDestination: (uri, name, mimeType) => FileSystem.StorageAccessFramework.createFileAsync(uri, name, mimeType),
        writeDestination: (uri, text) => FileSystem.writeAsStringAsync(uri, text),
      });
      setStatus(delivery === 'shared' ? de.settings.exportSuccess : delivery === 'saved' ? de.settings.exportSaved : de.settings.exportCancelled);
    } catch {
      setStatus(de.settings.exportError);
    } finally {
      operationInFlight.current = false;
      setBusy(null);
    }
  }

  async function handleImport() {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setBusy('Import wird geprüft …');
    let pickedUri: string | null = null;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (picked.canceled || !picked.assets?.[0]) return;
      pickedUri = picked.assets[0].uri;
      const info = await FileSystem.getInfoAsync(picked.assets[0].uri);
      if (info.exists && typeof info.size === 'number' && info.size > MAX_EXPORT_BYTES) throw new Error('Export-Datei ist zu groß');
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const outcome = await importThenHydrate(raw, importExportJson, async () => { await useSettingsStore.getState().hydrate(); });
      if (outcome.phase === 'hydrated') { setHydrateRetryNeeded(false); setStatus(de.settings.importSuccess); }
      else if (outcome.phase === 'hydrate-failed') { setHydrateRetryNeeded(true); setStatus(de.settings.importHydrateError); }
      else throw outcome.error;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setStatus(message.startsWith('Export-Datei') || message.includes('ungültige')
        ? `Import abgelehnt: ${message}`
        : `${de.settings.importError} Die Datenbank wurde nicht geändert.`);
    } finally {
      const pickedCacheUri = pickedUri;
      if (pickedCacheUri) {
        const removed = await cleanupImportCopy(async () => { await cleanupPickedCacheAsset(pickedCacheUri, FileSystem.cacheDirectory ?? '', FileSystem); });
        if (!removed) setStatus((previous) => previous ? `${previous} ${de.settings.importCleanupWarning}` : de.settings.importCleanupWarning);
      }
      operationInFlight.current = false;
      setBusy(null);
    }
  }

  async function retrySettingsHydrate() {
    if (operationInFlight.current) return;
    operationInFlight.current = true; setBusy('Einstellungen werden aktualisiert …');
    try { await useSettingsStore.getState().hydrate(); setHydrateRetryNeeded(false); setStatus(de.settings.importSuccess); }
    catch { setStatus(de.settings.importHydrateError); }
    finally { operationInFlight.current = false; setBusy(null); }
  }

  function handleResetOnboarding() {
    if (operationInFlight.current) return;
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
    if (operationInFlight.current) return;
    Alert.alert(de.settings.deleteAllConfirmTitle, de.settings.deleteAllConfirmBody, [
      { text: de.settings.deleteAllConfirmNo, style: 'cancel' },
      {
        text: de.settings.deleteAllConfirmYes,
        style: 'destructive',
        onPress: async () => {
          if (operationInFlight.current) return;
          operationInFlight.current = true;
          setBusy('Daten und Downloads werden gelöscht …');
          let resetLease: ReturnType<typeof clearPlayerAndDownloads> | null = null;
          try {
            resetLease = clearPlayerAndDownloads();
            await resetLease.ready;
            await cleanupPrivateExportCache(FileSystem.cacheDirectory ?? '', FileSystem);
            await wipeAllTables();
          } catch {
            setStatus('Löschen fehlgeschlagen. Daten wurden möglicherweise nicht vollständig entfernt.');
            return;
          } finally {
            resetLease?.release();
            operationInFlight.current = false;
            setBusy(null);
          }
          useSettingsStore.setState({
            hydrated: false, onboardingDone: false, colorScheme: 'system', dailyGoalMinutes: 20,
            dailyLearningSecondsToday: null, firstFormPreference: 'read', preferredLearnTime: null,
            quizLength: 10, reviewIntensity: 'normal', notificationsEnabled: false,
            telemetryEnabled: false, installId: '',
          });
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
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: theme.colors.text }]}>{de.settings.title}</Text>
        <View style={{ width: theme.minTapTarget }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      {busy ? (
        <View accessibilityRole="progressbar" accessibilityLabel={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={{ color: theme.colors.text }}>{busy}</Text>
        </View>
      ) : null}
      {status ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textWeak, marginBottom: theme.spacing.sm }}>{status}</Text> : null}

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

      <SwitchRow
        theme={theme}
        title={de.settings.notificationsTitle}
        body={de.settings.notificationsBody}
        value={false}
        disabled
      />
      <SwitchRow theme={theme} title={de.settings.telemetryTitle} body={de.settings.telemetryBody} value={false} disabled />

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.text }]}>{de.settings.exportTitle}</Text>
        <ActionButton theme={theme} label={de.settings.exportAction} onPress={handleExport} disabled={Boolean(busy)} />
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.text, marginTop: theme.spacing.base }]}>{de.settings.importTitle}</Text>
        <ActionButton theme={theme} label={de.settings.importAction} onPress={handleImport} disabled={Boolean(busy)} />
        {hydrateRetryNeeded ? <ActionButton theme={theme} label={de.settings.importHydrateRetry} onPress={retrySettingsHydrate} disabled={Boolean(busy)} /> : null}
        {status ? <Text accessibilityLiveRegion="polite" style={[styles.status, { color: theme.colors.textWeak }]}>{status}</Text> : null}
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.text }]}>{de.settings.resetOnboardingTitle}</Text>
        <ActionButton theme={theme} label={de.settings.resetOnboardingAction} onPress={handleResetOnboarding} />
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.error }]}>{de.settings.deleteAllTitle}</Text>
        <ActionButton theme={theme} label={de.settings.deleteAllAction} onPress={handleDeleteAll} destructive disabled={Boolean(busy)} />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionGroup({ theme, title, children }: { theme: ReturnType<typeof useTheme>; title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.text }]}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>{children}</View>
    </View>
  );
}

function ChoicePill({ theme, label, active, onPress }: { theme: ReturnType<typeof useTheme>; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.colors.accent : theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.full,
          minHeight: theme.minTapTarget,
          minWidth: theme.minTapTarget,
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
  disabled,
}: {
  theme: ReturnType<typeof useTheme>;
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.switchRow, { marginTop: theme.spacing.lg }]}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.status, { color: theme.colors.textWeak }]}>{body}</Text>
      </View>
      <Switch value={value} disabled={disabled} accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} />
    </View>
  );
}

function ActionButton({ theme, label, onPress, destructive, disabled }: { theme: ReturnType<typeof useTheme>; label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[
        styles.actionButton,
        {
          backgroundColor: destructive ? theme.colors.error : theme.colors.accent,
          borderRadius: theme.radius.md,
          marginTop: theme.spacing.sm,
          minHeight: theme.minTapTarget,
          opacity: disabled ? 0.55 : 1,
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
