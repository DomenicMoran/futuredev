import Constants from 'expo-constants';
import {
  qaPlaylistAutofillName as qaPlaylistAutofillNameLogic,
  shouldApplyQaSkipOnboarding as shouldApplyQaSkipOnboardingLogic,
  type ExpoExtra,
} from './buildGateLogic.js';

export type { ExpoExtra, QaRuntimeSignals } from './buildGateLogic.js';

function runtimeSignals() {
  return {
    isDev: typeof __DEV__ !== 'undefined' && __DEV__,
    publicQaEnv: process.env.EXPO_PUBLIC_FUTUREDEV_QA,
  };
}

/** Liest `expo.extra` aus dem gebündelten Manifest (Release und Dev). */
export function readExpoExtra(): ExpoExtra | undefined {
  return (
    Constants.expoConfig?.extra ??
    (Constants as { manifest?: { extra?: ExpoExtra } }).manifest?.extra
  );
}

export function shouldApplyQaSkipOnboarding(extra: ExpoExtra | undefined = readExpoExtra()): boolean {
  return shouldApplyQaSkipOnboardingLogic(extra, runtimeSignals());
}

export function qaPlaylistAutofillName(extra: ExpoExtra | undefined = readExpoExtra()): string {
  return qaPlaylistAutofillNameLogic(extra, runtimeSignals());
}
