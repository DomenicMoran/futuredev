// Gemeinsame Typen für Einstellungen und Wiederholungsintensität. Der
// eigentliche Gerätezugriff (Tabellen aus datenmodell.md, Abschnitt b) läuft
// über Agent B's `src/data/`; `EXPORTABLE_TABLES` bleibt hier nur noch für
// `src/settings/db.ts` (Einstellungen "Alles löschen").

export type ReviewIntensity = 'leicht' | 'normal' | 'intensiv';

// Faktor auf die Tagesration (lehrplan-konzept.md, Abschnitt 6).
export const REVIEW_INTENSITY_FACTOR: Record<ReviewIntensity, number> = {
  leicht: 0.5,
  normal: 1,
  intensiv: 1.5,
};

export interface AppSettings {
  onboardingDone: boolean;
  goal: 'career' | 'interest' | null;
  firstFormPreference: 'read' | 'listen';
  dailyGoalMinutes: number;
  quizLength: number;
  reviewIntensity: ReviewIntensity;
  notificationsEnabled: boolean;
  colorScheme: 'system' | 'light' | 'dark';
  telemetryEnabled: boolean;
  installId: string;
}

export const DEFAULT_QUIZ_LENGTH = 10;

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingDone: false,
  goal: null,
  firstFormPreference: 'read',
  dailyGoalMinutes: 20,
  quizLength: DEFAULT_QUIZ_LENGTH,
  reviewIntensity: 'normal',
  notificationsEnabled: false,
  colorScheme: 'system',
  telemetryEnabled: false,
  installId: '',
};

// Reihenfolgen der Tabellen aus datenmodell.md, für Export/Import in derselben
// Reihenfolge und für das serienweise Löschen bei "Alles löschen".
export const EXPORTABLE_TABLES = [
  'progress',
  'reviews',
  'notes',
  'bookmarks',
  'settings',
  'portfolio_items',
  'career_checklist',
  'exam_results',
] as const;

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number];
