// Vorläufige, aber sinnvolle Werte. Die endgültigen Werte übernehmen wir aus der
// Vault-Notiz 10_Projekte/FutureDev/Wissen/design-system.md, sobald sie vorliegt
// (Entscheidung 9 des Zusatzauftrags Phase 2: eigenes Design-System, kein geteilter
// Baukasten, Apple-Niveau ohne KI-Slop).

export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F6F8',
    border: '#D9DCE1',
    textPrimary: '#14181F',
    textSecondary: '#4B5563',
    accent: '#2B5FA6',
    success: '#2E7D5B',
    error: '#B3402B',
  },
  dark: {
    background: '#0E1116',
    surface: '#171B22',
    border: '#2A2F3A',
    textPrimary: '#F2F4F7',
    textSecondary: '#A6ADB8',
    accent: '#6C9DE0',
    success: '#4CAF7D',
    error: '#E07856',
  },
} as const;

// 8-Punkt-Raster.
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const type = {
  // Systemschrift: keine eigene Schriftdatei, sieht auf jedem Gerät nativ aus.
  fontFamily: 'System',
  size: {
    caption: 13,
    body: 16,
    subtitle: 18,
    title: 22,
    headline: 28,
  },
  lineHeight: {
    caption: 18,
    body: 24,
    subtitle: 26,
    title: 28,
    headline: 34,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const motion = {
  // Kurze, funktionale Dauer statt Zierde (feedback_performance_first).
  durationFast: 120,
  durationBase: 200,
  durationSlow: 320,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  // Wird von jeder Animation respektiert: bei aktivem Reduced-Motion auf 0 kürzen,
  // nie nur per CSS-Regel (feedback_reduced_motion_css_reicht_nicht).
  respectReducedMotion: true,
} as const;

// Zielgröße für tippbare Elemente, mindestens 44 Punkt (Apple-Richtlinie, gilt hier
// projektübergreifend als Untergrenze).
export const minTapTarget = 44;

export * from './contrast.js';
