// Jobreife-Formel aus 10_Projekte/FutureDev/Wissen/lehrplan-konzept.md, Abschnitt 9:
// gewichtetes Mittel aus drei zu je einem Drittel gewichteten Anteilen, sofern der
// Nutzer nichts anders einstellt.

export interface JobreifeInput {
  passedCoreModulesCount: number;
  totalCoreModulesCount: number;
  publishedPortfolioItemsCount: number;
  totalPortfolioItemsCount: number;
  completedCareerChecklistCount: number;
  totalCareerChecklistCount: number;
  /** Gewichte, Summe muss 1 ergeben. Ohne Angabe: je ein Drittel. */
  weights?: { modules: number; portfolio: number; career: number };
}

export interface JobreifeResult {
  /** 0 bis 100. */
  percent: number;
  missing: string[];
}

const DEFAULT_WEIGHTS = { modules: 1 / 3, portfolio: 1 / 3, career: 1 / 3 };

function shareOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

export function computeJobreife(input: JobreifeInput): JobreifeResult {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const weightSum = weights.modules + weights.portfolio + weights.career;
  if (Math.abs(weightSum - 1) > 1e-9) {
    throw new Error(`Gewichte müssen sich zu 1 summieren, ergaben ${weightSum}`);
  }

  const moduleShare = shareOf(input.passedCoreModulesCount, input.totalCoreModulesCount);
  const portfolioShare = shareOf(input.publishedPortfolioItemsCount, input.totalPortfolioItemsCount);
  const careerShare = shareOf(input.completedCareerChecklistCount, input.totalCareerChecklistCount);

  const percent =
    (moduleShare * weights.modules + portfolioShare * weights.portfolio + careerShare * weights.career) * 100;

  const missing: string[] = [];
  const missingModules = input.totalCoreModulesCount - input.passedCoreModulesCount;
  const missingPortfolio = input.totalPortfolioItemsCount - input.publishedPortfolioItemsCount;
  const missingCareer = input.totalCareerChecklistCount - input.completedCareerChecklistCount;
  if (missingModules > 0) missing.push(`${missingModules} Pflichtkern-Modul(e) noch nicht bestanden`);
  if (missingPortfolio > 0) missing.push(`${missingPortfolio} Portfolio-Baustein(e) noch nicht veröffentlicht`);
  if (missingCareer > 0) missing.push(`${missingCareer} Karriere-Checklistenpunkt(e) noch offen`);

  return { percent, missing };
}

// Regel, die immer neben der Anzeige steht (lehrplan-konzept.md, Abschnitt 9):
// keine Job-Garantie, die Anzeige zeigt Vorbereitung, nicht die Zusage eines
// Arbeitgebers.
export const JOBREIFE_DISCLAIMER =
  'Die Jobreife-Anzeige zeigt den Stand der Vorbereitung, keine Zusage eines Arbeitgebers.';
