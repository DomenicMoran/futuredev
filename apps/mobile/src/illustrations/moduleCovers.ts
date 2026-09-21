/* eslint-disable @typescript-eslint/no-require-imports -- statische PNG-Assets, Metro require()-Pfad */
import type { ImageSourcePropType } from 'react-native';

// Statische Modul-Cover M01–M10 (assets/illustrations/*.png, erzeugt via
// scripts/make-illustrations.mjs). Kein Laufzeit-Fetch, kein Schema-Feld nötig.
const covers: Record<string, ImageSourcePropType> = {
  M01: require('../../assets/illustrations/M01.png'),
  M02: require('../../assets/illustrations/M02.png'),
  M03: require('../../assets/illustrations/M03.png'),
  M04: require('../../assets/illustrations/M04.png'),
  M05: require('../../assets/illustrations/M05.png'),
  M06: require('../../assets/illustrations/M06.png'),
  M07: require('../../assets/illustrations/M07.png'),
  M08: require('../../assets/illustrations/M08.png'),
  M09: require('../../assets/illustrations/M09.png'),
  M10: require('../../assets/illustrations/M10.png'),
};

export function getModuleCover(moduleId: string): ImageSourcePropType | null {
  return covers[moduleId] ?? null;
}

export const onboardingIllustration = require('../../assets/illustrations/onboarding.png');
