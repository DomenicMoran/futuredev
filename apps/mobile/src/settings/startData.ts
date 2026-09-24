// Datengrundlage für den Start-Reiter: letzte Lektion mit Position,
// nächste Empfehlung, Tagesration, Wochenübersicht. Nutzt Agent B's
// `src/data/` und `src/content/` für den Gerätezugriff.
import { getDatabase } from '../data/db.js';
import { listProgress } from '../data/progress.js';
import { getContentFs, loadLocalManifest } from '../content/index.js';
import { loadModules } from '../content/lessonLoader.js';
import { buildModuleList } from '../content/listLessons.js';
import { loadReviewCards } from '../review/cards.js';
import { dailyRationSize, selectDailyRation } from '../review/dailyRation.js';
import { de } from '../i18n/de.js';
import { getSetting } from '../data/settings.js';
import { DAILY_LEARNING_DATE_KEY, localDateKey, readDailyLearningSecondsToday } from './dailyLearning.js';
import type { ReviewIntensity } from './types.js';

export interface ContinueCard {
  lessonId: string;
  lessonTitle: string;
  state: string;
  positionLabel: string | null;
  readUntil: number | null;
  listenedUntil: number | null;
}

export interface WeekDay {
  date: string; // ISO-Datum (Tag)
  studied: boolean;
}

export interface StartData {
  continueCard: ContinueCard | null;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  dueReviewCount: number;
  /** Sekunden Lernzeit heute (Hören); null wenn noch kein Tageseintrag in SQLite. */
  dailyLearningSecondsToday: number | null;
  week: WeekDay[];
}

export async function loadStartData(dailyGoalMinutes: number, reviewIntensity: ReviewIntensity): Promise<StartData> {
  const db = await getDatabase();
  const [progressRows, examRows, reviewCards, fs, dailyLearningSecondsToday] = await Promise.all([
    listProgress(),
    db.listExamResults(),
    loadReviewCards(),
    getContentFs(),
    readDailyLearningSecondsToday(),
  ]);
  const manifest = await loadLocalManifest(fs);
  const modulesFile = await loadModules(fs);
  const lessonTitleById = new Map<string, string>();
  if (modulesFile) {
    const moduleList = await buildModuleList(modulesFile, manifest, fs);
    for (const mod of moduleList) {
      for (const sub of mod.subModules) {
        for (const lesson of sub.lessons) {
          lessonTitleById.set(lesson.id, lesson.title);
        }
      }
    }
  }
  const lessonTitle = (lessonId: string): string => lessonTitleById.get(lessonId) ?? de.start.lessonTitleFallback;

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
    continueCard = {
      lessonId: last.lessonId,
      lessonTitle: lessonTitle(last.lessonId),
      state: last.state,
      positionLabel,
      readUntil: last.readUntil,
      listenedUntil: last.listenedUntil,
    };
  }

  const completedLessonIds = new Set(progressRows.filter((r) => r.state === 'completed').map((r) => r.lessonId));
  const orderedLessonIds = (manifest?.lessons ?? []).map((l) => l.id).sort();
  const nextLessonId = orderedLessonIds.find((id) => !completedLessonIds.has(id)) ?? null;
  const nextLessonTitle = nextLessonId ? lessonTitle(nextLessonId) : null;

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

  const storedDate = await getSetting(DAILY_LEARNING_DATE_KEY);
  const hasDailyEntry = storedDate === localDateKey();

  return {
    continueCard,
    nextLessonId,
    nextLessonTitle,
    dueReviewCount,
    dailyLearningSecondsToday: hasDailyEntry ? dailyLearningSecondsToday : null,
    week,
  };
}
