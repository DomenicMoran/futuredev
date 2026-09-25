import { describe, expect, it } from 'vitest';
import {
  hasNonStoreQaSignal,
  qaPlaylistAutofillName,
  shouldApplyQaSkipOnboarding,
  type ExpoExtra,
} from './buildGateLogic.js';

const prodSignals = { isDev: false, publicQaEnv: undefined as string | undefined };

describe('buildGateLogic', () => {
  const storeExtra: ExpoExtra = {
    qaSkipOnboarding: false,
    qaEmulatorBuild: false,
    qaPlaylistAutofill: 'perfectgate018',
  };

  it('skips onboarding only when extra flag and non-store signal', () => {
    expect(shouldApplyQaSkipOnboarding(storeExtra, prodSignals)).toBe(false);
    expect(
      shouldApplyQaSkipOnboarding({ qaSkipOnboarding: true, qaEmulatorBuild: false }, prodSignals),
    ).toBe(false);
    expect(
      shouldApplyQaSkipOnboarding(
        { qaSkipOnboarding: true, qaEmulatorBuild: true },
        prodSignals,
      ),
    ).toBe(true);
  });

  it('playlist autofill is empty outside QA build', () => {
    expect(qaPlaylistAutofillName(storeExtra, prodSignals)).toBe('');
    expect(
      qaPlaylistAutofillName(
        { qaPlaylistAutofill: 'perfectgate018', qaEmulatorBuild: true },
        prodSignals,
      ),
    ).toBe('perfectgate018');
  });

  it('hasNonStoreQaSignal respects qaEmulatorBuild and env', () => {
    expect(hasNonStoreQaSignal({ qaEmulatorBuild: false }, prodSignals)).toBe(false);
    expect(hasNonStoreQaSignal({ qaEmulatorBuild: true }, prodSignals)).toBe(true);
    expect(hasNonStoreQaSignal(undefined, { isDev: false, publicQaEnv: '1' })).toBe(true);
  });
});
