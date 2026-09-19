// Werte aus der Vault-Notiz 10_Projekte/FutureDev/Wissen/design-system.md
// (Abschnitt "Token als TypeScript-Objekt"), abgeglichen von Agent A in Phase 3
// (Entscheidung 9 des Zusatzauftrags Phase 2: eigenes Design-System, kein
// geteilter Baukasten, Apple-Niveau ohne KI-Slop).

export const colors = {
  light: {
    bg: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#14181F',
    textWeak: '#5B6472',
    accent: '#2A5FD9',
    accentText: '#FFFFFF',
    success: '#177A56',
    warning: '#8F5B00',
    error: '#C22F3A',
    border: '#E2E5EA',
  },
  dark: {
    bg: '#0F1116',
    surface: '#171A21',
    text: '#EDEFF3',
    textWeak: '#A3ABB8',
    accent: '#5B8DFF',
    accentText: '#0B1220',
    success: '#4ADE94',
    warning: '#FFB955',
    error: '#FF6B76',
    border: '#2A2F3A',
  },
} as const;

// 8-Punkt-Raster.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const type = {
  family: {
    android: 'Roboto',
    ios: 'System', // System = SF auf iOS
    web: 'Inter',
  },
  size: {
    xs: { size: 12, lineHeight: 16 },
    sm: { size: 14, lineHeight: 20 },
    base: { size: 16, lineHeight: 24 },
    lg: { size: 18, lineHeight: 26 },
    xl: { size: 22, lineHeight: 30 },
    '2xl': { size: 28, lineHeight: 36 },
    '3xl': { size: 34, lineHeight: 42 },
  },
  weight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;

export const motion = {
  durationMs: {
    short: 150,
    base: 200,
    long: 250,
  },
} as const;

// Zielgroesse fuer tippbare Elemente, mindestens 44 Punkt (Apple-Richtlinie,
// gilt hier projektuebergreifend als Untergrenze).
export const minTapTarget = 44;

export * from './contrast.js';
