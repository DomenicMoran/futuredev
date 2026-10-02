import type { CareerDisplayItem, PortfolioDisplayItem, ProfileData, ProfileToolsData } from './profile.js';

export type ProfileToolsViewModel = {
  portfolio: PortfolioDisplayItem[];
  career: CareerDisplayItem[];
  interactive: boolean;
  showToolsLoading: boolean;
  showToolsError: boolean;
};

/** Tools load failure is not shown while a newer fetch is still in flight. */
export function shouldShowProfileToolsError(toolsError: boolean, toolsLoading: boolean): boolean {
  return toolsError && !toolsLoading;
}

/** Editable portfolio/career always come from the independent tools snapshot, never stale profile data. */
export function resolveProfileToolsViewModel(input: {
  tools: ProfileToolsData | null;
  profile: ProfileData | null;
  toolsLoading: boolean;
  toolsError: boolean;
  staticPortfolio: PortfolioDisplayItem[];
  staticCareer: CareerDisplayItem[];
}): ProfileToolsViewModel {
  if (input.tools) {
    return {
      portfolio: input.tools.portfolio,
      career: input.tools.career,
      interactive: true,
      showToolsLoading: false,
      showToolsError: false,
    };
  }

  if (input.toolsLoading) {
    return {
      portfolio: input.staticPortfolio,
      career: input.staticCareer,
      interactive: false,
      showToolsLoading: true,
      showToolsError: false,
    };
  }

  if (shouldShowProfileToolsError(input.toolsError, input.toolsLoading)) {
    return {
      portfolio: [],
      career: [],
      interactive: false,
      showToolsLoading: false,
      showToolsError: true,
    };
  }

  return {
    portfolio: input.staticPortfolio,
    career: input.staticCareer,
    interactive: false,
    showToolsLoading: false,
    showToolsError: false,
  };
}
