import { create } from 'zustand';

// Onboarding-Zustand: drei Schritte, nur im Speicher (Agent D hängt die
// Persistenz an SQLite an). `completed` steuert die Weiterleitung im
// Root-Layout.
export type OnboardingGoal = 'career' | 'interest';

interface OnboardingState {
  completed: boolean;
  goal: OnboardingGoal | null;
  setGoal: (goal: OnboardingGoal) => void;
  complete: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  goal: null,
  setGoal: (goal) => set({ goal }),
  complete: () => set({ completed: true }),
}));
