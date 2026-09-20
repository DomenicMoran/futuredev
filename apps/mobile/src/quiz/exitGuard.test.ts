import { describe, expect, it } from 'vitest';
import { shouldConfirmExit } from './exitGuard.js';

describe('shouldConfirmExit', () => {
  it('braucht keine Rueckfrage vor dem Start (Regeln-Bildschirm)', () => {
    expect(shouldConfirmExit('rules')).toBe(false);
  });

  it('braucht eine Rueckfrage waehrend eine Frage offen ist', () => {
    expect(shouldConfirmExit('question')).toBe(true);
  });

  it('braucht eine Rueckfrage waehrend die Rueckmeldung zu einer Frage steht', () => {
    expect(shouldConfirmExit('feedback')).toBe(true);
  });

  it('braucht keine Rueckfrage nach dem Ergebnis (nichts geht mehr verloren)', () => {
    expect(shouldConfirmExit('result')).toBe(false);
  });
});
