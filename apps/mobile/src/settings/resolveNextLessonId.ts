/** Nächste offene Lektion in Curriculum-Reihenfolge (kein alphabetisches Sort). */
export function resolveNextLessonId(
  orderedLessonIds: readonly string[],
  completedLessonIds: ReadonlySet<string>,
): string | null {
  return orderedLessonIds.find((id) => !completedLessonIds.has(id)) ?? orderedLessonIds[0] ?? null;
}
