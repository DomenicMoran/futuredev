import { router } from 'expo-router';
import { getFirstPublishedLessonId, type ModuleListEntry } from '../content/listLessons.js';

export function openFirstPublishedLessonOrLernen(moduleList: readonly ModuleListEntry[]): void {
  const lessonId = getFirstPublishedLessonId(moduleList);
  if (lessonId) {
    router.push(`/lesson/${lessonId}`);
    return;
  }
  router.push('/(tabs)/lernen');
}
