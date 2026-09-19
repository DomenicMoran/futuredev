// Reine Funktion ohne Abhängigkeit von react-native, damit sie ohne
// React-Native-Testumgebung geprüft werden kann (die Vitest-Umgebung kann den
// Flow-Quelltext von react-native/index.js nicht parsen).
export type ColorSchemeSetting = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

export function resolveColorScheme(
  setting: ColorSchemeSetting,
  systemScheme: string | null | undefined,
): ResolvedColorScheme {
  if (setting !== 'system') return setting;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
