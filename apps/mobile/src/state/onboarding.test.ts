import { beforeEach, describe, expect, it } from 'vitest';
import { useOnboardingStore } from './onboarding.js';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ completed: false, goal: null });
  });

  it('startet unvollständig ohne Ziel', () => {
    const state = useOnboardingStore.getState();
    expect(state.completed).toBe(false);
    expect(state.goal).toBeNull();
  });

  it('setzt das Ziel, ohne den Abschluss auszulösen', () => {
    useOnboardingStore.getState().setGoal('career');
    const state = useOnboardingStore.getState();
    expect(state.goal).toBe('career');
    expect(state.completed).toBe(false);
  });

  it('markiert das Onboarding als abgeschlossen', () => {
    useOnboardingStore.getState().complete();
    expect(useOnboardingStore.getState().completed).toBe(true);
  });
});
