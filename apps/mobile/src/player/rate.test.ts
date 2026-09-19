import { describe, expect, it } from 'vitest';
import { RATE_OPTIONS, clampRate, decreaseRate, increaseRate } from './rate.js';

describe('clampRate', () => {
  it('lässt einen gültigen Wert unverändert', () => {
    expect(clampRate(1.2)).toBe(1.2);
  });

  it('klemmt nach unten auf 0,8', () => {
    expect(clampRate(0.3)).toBe(0.8);
  });

  it('klemmt nach oben auf 2,0', () => {
    expect(clampRate(5)).toBe(2.0);
  });
});

describe('increaseRate/decreaseRate', () => {
  it('erhöht in 0,1-Schritten ohne Fließkomma-Drift', () => {
    let rate = 0.8;
    for (let i = 0; i < 12; i += 1) rate = increaseRate(rate);
    expect(rate).toBe(2.0);
  });

  it('bleibt an der Obergrenze stehen', () => {
    expect(increaseRate(2.0)).toBe(2.0);
  });

  it('verringert in 0,1-Schritten', () => {
    expect(decreaseRate(1.0)).toBe(0.9);
  });

  it('bleibt an der Untergrenze stehen', () => {
    expect(decreaseRate(0.8)).toBe(0.8);
  });
});

describe('RATE_OPTIONS', () => {
  it('enthält genau 13 Werte von 0,8 bis 2,0', () => {
    expect(RATE_OPTIONS).toHaveLength(13);
    expect(RATE_OPTIONS[0]).toBe(0.8);
    expect(RATE_OPTIONS.at(-1)).toBe(2.0);
  });
});
