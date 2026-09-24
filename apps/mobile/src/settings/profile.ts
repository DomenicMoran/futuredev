// Lädt die Daten für den Reiter Ich: Fortschritt je Modul, Jobreife,
// Portfolio-Bausteine, Karriere-Checkliste, Notizen, Lesezeichen. Nutzt Agent
// B's `src/data/` (Database-Schnittstelle) und `src/content/`
// (Manifest/ContentFs) für den Gerätezugriff, dazu die Inhaltsdateien
// content/modules.json, content/portfolio.json, content/career.json.
import type { Manifest } from '@futuredev/content-schema';
import { computeModuleProgress, computeReadiness, type LessonProgress, type ReadinessResult } from '@futuredev/core';
import { getDatabase } from '../data/db.js';
import { listProgress } from '../data/progress.js';
import { listNotes } from '../data/notes.js';
import { listBookmarks } from '../data/bookmarks.js';
import { getContentFs, loadLocalManifest } from '../content/index.js';
import { de } from '../i18n/de.js';
import { bundledManifest } from '../../assets/content/bundled.generated.js';
import modulesFile from '../../../../content/modules.json';
import portfolioFile from '../../../../content/portfolio.json';
import careerFile from '../../../../content/career.json';

export interface PortfolioDisplayItem {
  id: string;
  title: string;
  goal: string;
  status: 'offen' | 'veroeffentlicht' | 'erklaert';
  url: string | null;
}

export interface CareerDisplayItem {
  id: string;
  title: string;
  description: string;
  checked: boolean;
}

export interface NoteDisplayItem {
  id: string;
  lessonId: string;
  body: string;
  updatedAt: string;
}

export interface BookmarkDisplayItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  position: number;
  createdAt: string;
}

export interface ModuleProgressDisplay {
  moduleId: string;
  moduleTitle: string;
  percent: number;
  totalLessons: number;
  completedLessons: number;
}

export interface ProfileData {
  moduleProgress: ModuleProgressDisplay[];
  readiness: ReadinessResult;
  portfolio: PortfolioDisplayItem[];
  career: CareerDisplayItem[];
  notes: NoteDisplayItem[];
  bookmarks: BookmarkDisplayItem[];
}

const bundledFallbackManifest = bundledManifest as unknown as Manifest;

function lessonBelongsToModule(lessonId: string, moduleId: string): boolean {
  return lessonId === moduleId || lessonId.startsWith(`${moduleId}-`);
}

async function knownLessonIds(): Promise<string[]> {
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  const lessons = manifest?.lessons?.length ? manifest.lessons : bundledFallbackManifest.lessons;
  return lessons.map((l) => l.id);
}

export async function loadProfileData(): Promise<ProfileData> {
  const db = await getDatabase();
  const [progressRows, portfolioRows, careerRows, examRows, noteRows, bookmarkRows, lessonIds] = await Promise.all([
    listProgress(),
    db.listPortfolioItems(),
    db.listCareerChecklist(),
    db.listExamResults(),
    listNotes(),
    listBookmarks(),
    knownLessonIds(),
  ]);

  const progressByLesson = new Map(progressRows.map((r) => [r.lessonId, r]));

  const lessonTitleById = new Map<string, string>();
  const fs = await getContentFs();
  const manifest = await loadLocalManifest(fs);
  if (manifest) {
    const { buildModuleList } = await import('../content/listLessons.js');
    const { loadModules } = await import('../content/lessonLoader.js');
    const modulesLoaded = await loadModules(fs);
    if (modulesLoaded) {
      const moduleList = await buildModuleList(modulesLoaded, manifest, fs);
      for (const mod of moduleList) {
        for (const sub of mod.subModules) {
          for (const lesson of sub.lessons) {
            lessonTitleById.set(lesson.id, lesson.title);
          }
        }
      }
    }
  }

  const moduleProgress: ModuleProgressDisplay[] = modulesFile.modules.map((module) => {
    const moduleLessonIds = lessonIds.filter((id) => lessonBelongsToModule(id, module.id));
    const lessonProgresses: LessonProgress[] = moduleLessonIds.map((lessonId) => ({
      lessonId,
      state: progressByLesson.get(lessonId)?.state ?? 'new',
    }));
    const computed = computeModuleProgress(module.id, lessonProgresses);
    return {
      moduleId: computed.moduleId,
      moduleTitle: module.title,
      percent: computed.percent,
      totalLessons: computed.totalLessons,
      completedLessons: computed.completedLessons,
    };
  });

  const passedModuleIds = new Set(
    examRows.filter((r) => r.scope.startsWith('module:') && r.passed).map((r) => r.scope.slice('module:'.length)),
  );

  const portfolioByBaustein = new Map(portfolioRows.map((r) => [r.baustein, r]));
  const publishedPortfolioCount = portfolioFile.items.filter((item) => {
    const status = portfolioByBaustein.get(item.id)?.status;
    return status === 'veroeffentlicht' || status === 'erklaert';
  }).length;

  const careerByItem = new Map(careerRows.map((r) => [r.item, r]));
  const completedCareerCount = careerFile.items.filter((item) => careerByItem.get(item.id)?.checked === true).length;

  const readiness = computeReadiness({
    passedCoreModulesCount: passedModuleIds.size,
    totalCoreModulesCount: modulesFile.modules.length,
    publishedPortfolioItemsCount: publishedPortfolioCount,
    totalPortfolioItemsCount: portfolioFile.items.length,
    completedCareerChecklistCount: completedCareerCount,
    totalCareerChecklistCount: careerFile.items.length,
  });

  const portfolio: PortfolioDisplayItem[] = portfolioFile.items.map((item) => {
    const row = portfolioByBaustein.get(item.id);
    const status = row?.status;
    return {
      id: item.id,
      title: item.title,
      goal: item.goal,
      status: status === 'veroeffentlicht' || status === 'erklaert' ? status : 'offen',
      url: row?.url ?? null,
    };
  });

  const career: CareerDisplayItem[] = careerFile.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    checked: careerByItem.get(item.id)?.checked === true,
  }));

  const notes: NoteDisplayItem[] = [...noteRows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const bookmarks: BookmarkDisplayItem[] = [...bookmarkRows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({
      id: b.id,
      lessonId: b.lessonId,
      lessonTitle: lessonTitleById.get(b.lessonId) ?? de.start.lessonTitleFallback,
      position: b.position,
      createdAt: b.createdAt,
    }));

  return { moduleProgress, readiness, portfolio, career, notes, bookmarks };
}
