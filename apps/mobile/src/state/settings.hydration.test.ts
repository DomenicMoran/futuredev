import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../settings/persist.js', () => ({ hydrateSettings: vi.fn(), persistSetting: vi.fn() }));
vi.mock('../settings/dailyLearning.js', () => ({ DAILY_LEARNING_DATE_KEY: 'daily_learning_date', localDateKey: () => '2026-09-25', readDailyLearningSecondsToday: vi.fn(async () => 0) }));
vi.mock('../data/settings.js', () => ({ getSetting: vi.fn(async () => undefined) }));
vi.mock('./onboarding.js', () => ({ useOnboardingStore: { getState: () => ({ applyHydrated: vi.fn() }) } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));

import { hydrateSettings } from '../settings/persist.js';
import { useSettingsStore } from './settings.js';

const hydratedSettings = {
  onboardingDone: true,
  goal: 'interest' as const,
  firstFormPreference: 'read' as const,
  preferredLearnTime: 'morning' as const,
  dailyGoalMinutes: 20,
  quizLength: 12,
  reviewIntensity: 'normal' as const,
  notificationsEnabled: false,
  colorScheme: 'system' as const,
  telemetryEnabled: false,
  installId: 'test-install',
};

describe('settings hydration error state', () => {
  beforeEach(() => {
    vi.mocked(hydrateSettings).mockReset();
    useSettingsStore.setState({ hydrated: false, hydrationError: false });
  });

  it('keeps onboarding blocked and exposes retry after failure, then clears the error on success', async () => {
    vi.mocked(hydrateSettings).mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce(hydratedSettings);

    await expect(useSettingsStore.getState().hydrate()).rejects.toThrow('database unavailable');
    expect(useSettingsStore.getState().hydrated).toBe(false);
    expect(useSettingsStore.getState().hydrationError).toBe(true);

    await expect(useSettingsStore.getState().hydrate()).resolves.toEqual(hydratedSettings);
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(useSettingsStore.getState().hydrationError).toBe(false);
  });
});
