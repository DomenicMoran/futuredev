const TAB_ROOT_PATHS = new Set(['/', '/lernen', '/hoeren', '/ueben', '/ich']);

/** Entfernt Expo-Router-Gruppen wie `/(tabs)` für stabile Tab-Erkennung. */
export function normalizeAppPathname(pathname: string): string {
  if (!pathname) return '/';
  let normalized = pathname.replace(/\/\([^/)]+\)/g, '');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized === '') normalized = '/';
  return normalized;
}

/**
 * true auf den fünf Reiter-Hauptbildschirmen; false auf Stack-Routen
 * (Lektion, Modul, Onboarding, Vollbild-Player).
 */
export function isTabBarVisible(pathname: string): boolean {
  if (!pathname) return false;
  const normalized = normalizeAppPathname(pathname);
  if (normalized === '/onboarding' || normalized === '/player') return false;
  if (normalized.startsWith('/lesson/') || normalized.startsWith('/module/')) return false;
  return TAB_ROOT_PATHS.has(normalized);
}
