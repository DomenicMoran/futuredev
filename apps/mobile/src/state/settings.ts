import { create } from 'zustand';
import type { ColorSchemeSetting } from '../theme/colorScheme.js';

// Einstellungen, die das Gerüst schon braucht (Dunkelmodus, Tagesziel, Reihenfolge
// Lesen/Hören). Liegt in Phase 3 nur im Speicher; Agent D hängt das an SQLite
// (Settings-Tabelle aus datenmodell.md).
export type FirstFormPreference = 'read' | 'listen';

interface SettingsState {
  colorScheme: ColorSchemeSetting;
  dailyGoalMinutes: number;
  firstFormPreference: FirstFormPreference;
  setColorScheme: (value: ColorSchemeSetting) => void;
  setDailyGoalMinutes: (value: number) => void;
  setFirstFormPreference: (value: FirstFormPreference) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  colorScheme: 'system',
  dailyGoalMinutes: 20,
  firstFormPreference: 'read',
  setColorScheme: (value) => set({ colorScheme: value }),
  setDailyGoalMinutes: (value) => set({ dailyGoalMinutes: value }),
  setFirstFormPreference: (value) => set({ firstFormPreference: value }),
}));
