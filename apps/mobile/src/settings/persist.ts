// Bindeglied zwischen den Zustand-Stores (src/state/settings.ts,
// src/state/onboarding.ts) und der Tabelle `settings` (Agent B's `src/data/`,
// `getSetting`/`setSetting`/`getOrCreateInstallId`). Jeder Schlüssel
// entspricht einer Zeile `settings.key` (datenmodell.md, Abschnitt b).
import { getDatabase } from '../data/db.js';
import { setSetting, getOrCreateInstallId } from '../data/settings.js';
import { DEFAULT_SETTINGS, type AppSettings } from './types.js';

export const SETTINGS_KEYS = {
  onboardingDone: 'onboarding_done',
  goal: 'goal',
  firstFormPreference: 'first_form_preference',
  dailyGoalMinutes: 'daily_goal_minutes',
  quizLength: 'quiz_length',
  reviewIntensity: 'review_intensity',
  notificationsEnabled: 'notifications_enabled',
  colorScheme: 'color_scheme',
  telemetryEnabled: 'telemetry_enabled',
  installId: 'install_id',
} as const;

// Wird von den Stores als "fire and forget" aufgerufen (Store-Update zuerst,
// Schreiben danach): ein Fehler beim Schreiben darf die Bedienung nicht
// unterbrechen, wird aber protokolliert statt verschluckt.
export async function persistSetting(key: keyof typeof SETTINGS_KEYS, value: string | number | boolean): Promise<void> {
  try {
    await setSetting(SETTINGS_KEYS[key], String(value));
  } catch (err) {
    console.warn(`persistSetting(${key}) fehlgeschlagen:`, err);
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === '1' || value === 'true';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Liest alle Einstellungen aus SQLite und legt fehlende Werte (etwa eine neue install_id) an. */
export async function hydrateSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const rows = await db.listSettings();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;

  const installId = raw[SETTINGS_KEYS.installId] ?? (await getOrCreateInstallId());

  const goalRaw = raw[SETTINGS_KEYS.goal];
  const goal: AppSettings['goal'] = goalRaw === 'career' || goalRaw === 'interest' ? goalRaw : null;
  const firstFormPreference = raw[SETTINGS_KEYS.firstFormPreference] === 'listen' ? 'listen' : 'read';
  const colorSchemeRaw = raw[SETTINGS_KEYS.colorScheme];
  const colorScheme = colorSchemeRaw === 'light' || colorSchemeRaw === 'dark' ? colorSchemeRaw : 'system';
  const reviewIntensityRaw = raw[SETTINGS_KEYS.reviewIntensity];
  const reviewIntensity =
    reviewIntensityRaw === 'leicht' || reviewIntensityRaw === 'intensiv' ? reviewIntensityRaw : 'normal';

  return {
    onboardingDone: parseBool(raw[SETTINGS_KEYS.onboardingDone], DEFAULT_SETTINGS.onboardingDone),
    goal,
    firstFormPreference,
    dailyGoalMinutes: parseNumber(raw[SETTINGS_KEYS.dailyGoalMinutes], DEFAULT_SETTINGS.dailyGoalMinutes),
    quizLength: parseNumber(raw[SETTINGS_KEYS.quizLength], DEFAULT_SETTINGS.quizLength),
    reviewIntensity,
    notificationsEnabled: parseBool(raw[SETTINGS_KEYS.notificationsEnabled], DEFAULT_SETTINGS.notificationsEnabled),
    colorScheme,
    telemetryEnabled: parseBool(raw[SETTINGS_KEYS.telemetryEnabled], DEFAULT_SETTINGS.telemetryEnabled),
    installId,
  };
}
