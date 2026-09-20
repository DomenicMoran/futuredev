// Reine Logik zur Umrechnung einer normalen Übergangsdauer (design-system.md:
// "Dauer 150 bis 250 ms für alle Übergänge") in die tatsächlich zu
// verwendende Dauer, wenn Reduced Motion aktiv ist. CSS-Medienabfragen allein
// reichen nicht (siehe feedback_reduced_motion_css_reicht_nicht): jede
// JS/Reanimated-getriebene Bewegung in der App muss die Systemeinstellung
// selbst abfragen und respektieren, siehe useReducedMotion.ts.
export function resolveAnimationDuration(reducedMotionEnabled: boolean, normalDurationMs: number): number {
  return reducedMotionEnabled ? 0 : normalDurationMs;
}
