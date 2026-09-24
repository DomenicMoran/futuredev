import { create } from 'zustand';
import { persistSetting } from '../settings/persist.js';

// Onboarding-Zustand: drei Schritte. `completed` steuert die Weiterleitung im
// Root-Layout. Persistiert additiv über src/settings/persist.ts an
// `settings.onboarding_done` und `settings.goal` (AP-3.5, Punkt 6).
export type OnboardingGoal = 'career' | 'interest';

interface OnboardingState {
  completed: boolean;
  goal: OnboardingGoal | null;
  setGoal: (goal: OnboardingGoal) => void;
  complete: () => void;
  reset: () => void;
  /** Übernimmt einen aus SQLite gelesenen Stand (App-Start). */
  applyHydrated: (completed: boolean, goal: OnboardingGoal | null) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  goal: null,
  setGoal: (goal) => {
    set({ goal });
    void persistSetting('goal', goal);
  },
  complete: () => {
    set({ completed: true });
    void persistSetting('onboardingDone', true);
  },
  reset: () => {
    set({ completed: false, goal: null });
    void persistSetting('onboardingDone', false);
  },
  applyHydrated: (completed, goal) => set({ completed, goal }),
}));
