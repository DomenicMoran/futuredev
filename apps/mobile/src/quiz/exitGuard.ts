// Reine Zustandslogik fuer die Abbruch-Rueckfrage einer laufenden Pruefung
// (Pruefbericht Phase 3, B-02): waehrend eine Runde laeuft (Frage oder
// Rueckmeldung), muss jeder Weg nach draussen (Zurueck-Taste, Reiterwechsel,
// Navigation) erst bestaetigt werden. In "rules" (noch nicht gestartet) und
// "result" (Runde fertig, nichts geht mehr verloren) ist keine Rueckfrage
// noetig. Getrennt von QuizRunner.tsx, damit sich die Zustandslogik ohne
// BackHandler/Alert/expo-router mit Vitest pruefen laesst.
export type QuizGuardPhase = 'rules' | 'question' | 'feedback' | 'result';

/** Ob ein Verlassen der Pruefung in dieser Phase eine Rueckfrage braucht. */
export function shouldConfirmExit(phase: QuizGuardPhase): boolean {
  return phase === 'question' || phase === 'feedback';
}
