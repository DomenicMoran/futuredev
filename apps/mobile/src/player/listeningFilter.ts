import type { LessonStatus } from '../data/lessonStatus.js';
/** An open status editor pins its row until close so a filter change cannot destroy Undo. */
export function matchesListeningFilter(id: string, filter: string, status: LessonStatus, downloaded: boolean, matchesSearch: boolean, editingLessonId: string | null): boolean {
  if (id === editingLessonId) return true;
  if (!matchesSearch) return false;
  return filter === 'all' || filter === 'heard' && status.heard || filter === 'unheard' && !status.heard || filter === 'started' && status.started && !status.heard && !status.done || filter === 'offline' && downloaded;
}
