import { useColorScheme } from 'react-native';
import { colors, spacing, radius, type, motion, minTapTarget } from '@futuredev/design-tokens';
import { useSettingsStore } from '../state/settings.js';
import { resolveColorScheme, type ResolvedColorScheme } from './colorScheme.js';

export type { ColorSchemeSetting, ResolvedColorScheme } from './colorScheme.js';

export interface Theme {
  colors: (typeof colors)['light'] | (typeof colors)['dark'];
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  motion: typeof motion;
  minTapTarget: typeof minTapTarget;
  scheme: ResolvedColorScheme;
}

// Liefert die Token je Systemfarbschema und Einstellung (System/hell/dunkel).
// Die Einstellung liegt in Phase 3 nur im Speicher (Zustand-Store), Agent D
// hängt sie an SQLite (Technikvorgabe: Theme).
export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const colorSchemeSetting = useSettingsStore((s) => s.colorScheme);

  const resolved = resolveColorScheme(colorSchemeSetting, systemScheme);

  return {
    colors: colors[resolved],
    spacing,
    radius,
    type,
    motion,
    minTapTarget,
    scheme: resolved,
  };
}
