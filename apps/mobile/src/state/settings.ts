import Constants from 'expo-constants';
import { create } from 'zustand';
import type { ColorSchemeSetting } from '../theme/colorScheme.js';
import { getSetting } from '../data/settings.js';
import {
  DAILY_LEARNING_DATE_KEY,
  localDateKey,
  readDailyLearningSecondsToday,
} from '../settings/dailyLearning.js';
import { hydrateSettings, persistSetting } from '../settings/persist.js';
import { useOnboardingStore } from './onboarding.js';
import {
  DEFAULT_QUIZ_LENGTH,
  type AppSettings,
  type PreferredLearnTime,
  type ReviewIntensity,
} from '../settings/types.js';

// Einstellungen, die das Gerüst schon braucht (Dunkelmodus, Tagesziel, Reihenfolge
// Lesen/Hören) plus die Werte aus AP-3.5 (Quizlänge, Wiederholungsintensität,
// Benachrichtigungen, anonyme Statistik). Persistiert additiv über
// src/settings/persist.ts an die Tabelle `settings` (SQLite).
export type FirstFormPreference = 'read' | 'listen';

interface SettingsState {
  hydrated: boolean;
  /** Aus SQLite (`onboarding_done`), für Root-Redirect ohne Race zum Onboarding-Store. */
  onboardingDone: boolean;
  colorScheme: ColorSchemeSetting;
  dailyGoalMinutes: number;
  /** Lernsekunden heute (Hören + Lesefokus); null bis erster Tageseintrag in SQLite. */
  dailyLearningSecondsToday: number | null;
  firstFormPreference: FirstFormPreference;
  preferredLearnTime: PreferredLearnTime | null;
  quizLength: number;
  reviewIntensity: ReviewIntensity;
  notificationsEnabled: boolean;
  telemetryEnabled: boolean;
  installId: string;
  /** Liefert den vollständigen geladenen Stand zurück, damit app/_layout.tsx auch onboardingDone/goal auslesen kann. */
  hydrate: () => Promise<AppSettings>;
  setColorScheme: (value: ColorSchemeSetting) => void;
  setDailyGoalMinutes: (value: number) => void;
  setDailyLearningSecondsToday: (value: number | null) => void;
  setFirstFormPreference: (value: FirstFormPreference) => void;
  setPreferredLearnTime: (value: PreferredLearnTime) => void;
  setQuizLength: (value: number) => void;
  setReviewIntensity: (value: ReviewIntensity) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setTelemetryEnabled: (value: boolean) => void;
  setOnboardingDone: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hydrated: false,
  onboardingDone: false,
  colorScheme: 'system',
  dailyGoalMinutes: 20,
  dailyLearningSecondsToday: null,
  firstFormPreference: 'read',
  preferredLearnTime: null,
  quizLength: DEFAULT_QUIZ_LENGTH,
  reviewIntensity: 'normal',
  notificationsEnabled: false,
  telemetryEnabled: false,
  installId: '',
  hydrate: async () => {
    let loaded = await hydrateSettings();
    const extra =
      Constants.expoConfig?.extra ??
      (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
    if (extra?.qaSkipOnboarding === true && !loaded.onboardingDone) {
      loaded = {
        ...loaded,
        onboardingDone: true,
        goal: loaded.goal ?? 'interest',
        firstFormPreference: loaded.firstFormPreference ?? 'read',
        preferredLearnTime: loaded.preferredLearnTime ?? 'morning',
        dailyGoalMinutes: loaded.dailyGoalMinutes || 20,
      };
      await persistSetting('onboardingDone', true);
      if (loaded.goal) await persistSetting('goal', loaded.goal);
      await persistSetting('firstFormPreference', loaded.firstFormPreference);
      if (loaded.preferredLearnTime) await persistSetting('preferredLearnTime', loaded.preferredLearnTime);
      await persistSetting('dailyGoalMinutes', loaded.dailyGoalMinutes);
    }
    const secondsToday = await readDailyLearningSecondsToday();
    const storedDate = await getSetting(DAILY_LEARNING_DATE_KEY);
    const hasDailyEntry = storedDate === localDateKey();
    // Onboarding-Store vor hydrated=true, sonst leitet _layout einmalig fälschlich ins Onboarding (Deep-Link/Cold-Start).
    useOnboardingStore.getState().applyHydrated(loaded.onboardingDone, loaded.goal);
    set({
      hydrated: true,
      onboardingDone: loaded.onboardingDone,
      colorScheme: loaded.colorScheme,
      dailyGoalMinutes: loaded.dailyGoalMinutes,
      dailyLearningSecondsToday: hasDailyEntry ? secondsToday : null,
      firstFormPreference: loaded.firstFormPreference,
      preferredLearnTime: loaded.preferredLearnTime,
      quizLength: loaded.quizLength,
      reviewIntensity: loaded.reviewIntensity,
      notificationsEnabled: loaded.notificationsEnabled,
      telemetryEnabled: loaded.telemetryEnabled,
      installId: loaded.installId,
    });
    return loaded;
  },
  setColorScheme: (value) => {
    set({ colorScheme: value });
    void persistSetting('colorScheme', value);
  },
  setDailyGoalMinutes: (value) => {
    set({ dailyGoalMinutes: value });
    void persistSetting('dailyGoalMinutes', value);
  },
  setDailyLearningSecondsToday: (value) => {
    set({ dailyLearningSecondsToday: value });
  },
  setFirstFormPreference: (value) => {
    set({ firstFormPreference: value });
    void persistSetting('firstFormPreference', value);
  },
  setPreferredLearnTime: (value) => {
    set({ preferredLearnTime: value });
    void persistSetting('preferredLearnTime', value);
  },
  setQuizLength: (value) => {
    set({ quizLength: value });
    void persistSetting('quizLength', value);
  },
  setReviewIntensity: (value) => {
    set({ reviewIntensity: value });
    void persistSetting('reviewIntensity', value);
  },
  setNotificationsEnabled: (value) => {
    set({ notificationsEnabled: value });
    void persistSetting('notificationsEnabled', value);
  },
  setTelemetryEnabled: (value) => {
    set({ telemetryEnabled: value });
    void persistSetting('telemetryEnabled', value);
  },
  setOnboardingDone: (value) => {
    set({ onboardingDone: value });
  },
}));
