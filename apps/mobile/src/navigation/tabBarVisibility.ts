const TAB_ROOT_PATHS = new Set(['/', '/lernen', '/hoeren', '/ueben', '/ich']);

/**
 * true auf den fünf Reiter-Hauptbildschirmen; false auf Stack-Routen
 * (Lektion, Modul, Onboarding, Vollbild-Player).
 */
export function isTabBarVisible(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/onboarding' || pathname === '/player') return false;
  if (pathname.startsWith('/lesson/') || pathname.startsWith('/module/')) return false;
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return TAB_ROOT_PATHS.has(normalized);
}
