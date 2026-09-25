import { create } from 'zustand';
import { persistSetting } from '../settings/persist.js';

// Onboarding-Zustand: drei Schritte. `completed` steuert die Weiterleitung im
// Root-Layout. Persistiert additiv über src/settings/persist.ts an
// `settings.onboarding_done` und `settings.goal` (AP-3.5, Punkt 6).
export type OnboardingGoal = 'career' | 'interest' | 'upskill';

interface OnboardingState {
  completed: boolean;
  goal: OnboardingGoal | null;
  setGoal: (goal: OnboardingGoal) => void;
  complete: () => Promise<void>;
  reset: () => void;
  /** Übernimmt einen aus SQLite gelesenen Stand (App-Start). */
  applyHydrated: (completed: boolean, goal: OnboardingGoal | null) => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  completed: false,
  goal: null,
  setGoal: (goal) => {
    set({ goal });
  },
  complete: async () => {
    const goal = get().goal;
    set({ completed: true });
    await persistSetting('onboardingDone', true);
    if (goal) await persistSetting('goal', goal);
  },
  reset: () => {
    set({ completed: false, goal: null });
    void persistSetting('onboardingDone', false);
  },
  applyHydrated: (completed, goal) => set({ completed, goal }),
}));
