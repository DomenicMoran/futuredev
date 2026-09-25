export interface ExpoExtra {
  [key: string]: unknown;
}

export interface QaRuntimeSignals {
  isDev: boolean;
  publicQaEnv: string | undefined;
}

export function hasNonStoreQaSignal(
  extra: ExpoExtra | undefined,
  signals: QaRuntimeSignals,
): boolean {
  if (signals.isDev) return true;
  if (extra?.qaEmulatorBuild === true) return true;
  return signals.publicQaEnv === '1';
}

/** QA-Hilfen (Onboarding-Skip, Playlist-Autofill) nur außerhalb Store/Production-Release. */
export function isFutureDevQaBuild(
  extra: ExpoExtra | undefined,
  signals: QaRuntimeSignals,
): boolean {
  return hasNonStoreQaSignal(extra, signals);
}

export function shouldApplyQaSkipOnboarding(
  extra: ExpoExtra | undefined,
  signals: QaRuntimeSignals,
): boolean {
  // Production/Store-Release darf Onboarding nie überspringen — Gate plus extra-Flag.
  return extra?.qaSkipOnboarding === true && isFutureDevQaBuild(extra, signals);
}

export function qaPlaylistAutofillName(
  extra: ExpoExtra | undefined,
  signals: QaRuntimeSignals,
): string {
  if (!isFutureDevQaBuild(extra, signals)) return '';
  const fromExtra =
    extra && typeof extra.qaPlaylistAutofill === 'string' ? extra.qaPlaylistAutofill.trim() : '';
  return fromExtra.length > 0 ? fromExtra : 'perfectgate018';
}
