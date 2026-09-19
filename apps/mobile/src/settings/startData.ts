// Datengrundlage für den Start-Reiter: letzte Lektion mit Position,
// nächste Empfehlung, Tagesration, Wochenübersicht. Nutzt Agent B's
// `src/data/` und `src/content/` für den Gerätezugriff.
import { getDatabase } from '../data/db.js';
import { listProgress } from '../data/progress.js';
import { getContentFs, loadLocalManifest } from '../content/index.js';
import { loadReviewCards } from '../review/cards.js';
import { dailyRationSize, selectDailyRation } from '../review/dailyRation.js';
import type { ReviewIntensity } from './types.js';

export interface ContinueCard {
  lessonId: string;
  state: string;
  positionLabel: string | null;
}

export interface WeekDay {
  date: string; // ISO-Datum (Tag)
  studied: boolean;
}

export interface StartData {
  continueCard: ContinueCard | null;
  nextLessonId: string | null;
  dueReviewCount: number;
  week: WeekDay[];
}

export async function loadStartData(dailyGoalMinutes: number, reviewIntensity: ReviewIntensity): Promise<StartData> {
  const db = await getDatabase();
  const [progressRows, examRows, reviewCards, fs] = await Promise.all([
    listProgress(),
    db.listExamResults(),
    loadReviewCards(),
    getContentFs(),
  ]);
  const manifest = await loadLocalManifest(fs);

  const sortedProgress = [...progressRows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const last = sortedProgress[0];
  let continueCard: ContinueCard | null = null;
  if (last) {
    let positionLabel: string | null = null;
    if (last.state === 'listened' && last.listenedUntil != null) {
      const seconds = last.listenedUntil;
      const mm = Math.floor(seconds / 60);
      const ss = String(seconds % 60).padStart(2, '0');
      positionLabel = `${mm}:${ss}`;
    } else if (last.readUntil != null) {
      positionLabel = String(last.readUntil);
    }
    continueCard = { lessonId: last.lessonId, state: last.state, positionLabel };
  }

  const completedLessonIds = new Set(progressRows.filter((r) => r.state === 'completed').map((r) => r.lessonId));
  const orderedLessonIds = (manifest?.lessons ?? []).map((l) => l.id).sort();
  const nextLessonId = orderedLessonIds.find((id) => !completedLessonIds.has(id)) ?? null;

  const size = dailyRationSize(dailyGoalMinutes, reviewIntensity);
  const dueReviewCount = selectDailyRation(reviewCards, size).length;

  const activityDays = new Set<string>();
  for (const row of progressRows) {
    const day = row.updatedAt.slice(0, 10);
    if (day) activityDays.add(day);
  }
  for (const row of examRows) {
    const day = row.takenAt.slice(0, 10);
    if (day) activityDays.add(day);
  }
  const week: WeekDay[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    week.push({ date: iso, studied: activityDays.has(iso) });
  }

  return { continueCard, nextLessonId, dueReviewCount, week };
}
