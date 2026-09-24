import { describe, expect, it } from 'vitest';
import { isTabBarVisible } from './tabBarVisibility.js';

describe('isTabBarVisible', () => {
  it('ist true auf Reiter-Routen', () => {
    expect(isTabBarVisible('/')).toBe(true);
    expect(isTabBarVisible('/lernen')).toBe(true);
    expect(isTabBarVisible('/hoeren')).toBe(true);
  });

  it('ist false auf Stack-Routen ohne Reiterleiste', () => {
    expect(isTabBarVisible('/lesson/M01-01-01')).toBe(false);
    expect(isTabBarVisible('/module/M01')).toBe(false);
    expect(isTabBarVisible('/player')).toBe(false);
    expect(isTabBarVisible('/onboarding')).toBe(false);
  });
});
