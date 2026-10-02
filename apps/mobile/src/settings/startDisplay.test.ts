import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de.js';
import { resolveStartLessonTitle } from './startData.js';
import {
  formatDailyRationTileBody,
  isHydratingLessonTitle,
  resolveDailyRationDueState,
  resolvePublishedLessonDisplayTitle,
} from './startDisplay.js';
import type { ModuleListEntry } from '../content/listLessons.js';

describe('Start daily ration tile copy', () => {
  it('does not treat missing Start data as zero due reviews', () => {
    expect(formatDailyRationTileBody(resolveDailyRationDueState(null))).toBe(de.start.dailyRationTileUnavailable);
    expect(formatDailyRationTileBody(resolveDailyRationDueState(null))).not.toBe(de.start.dailyRationTileEmpty);
  });

  it('shows the empty copy only after a successful load with due=0', () => {
    expect(formatDailyRationTileBody(resolveDailyRationDueState({ dueReviewCount: 0 }))).toBe(
      de.start.dailyRationTileEmpty,
    );
  });

  it('shows the due count after a successful load with due>0', () => {
    expect(formatDailyRationTileBody(resolveDailyRationDueState({ dueReviewCount: 3 }))).toBe(
      de.start.dailyRationTileBody(3),
    );
  });
});

describe('Start lesson labels during content hydration', () => {
  it('uses the human fallback instead of displaying an unresolved internal lesson ID', () => {
    const unresolvedId = 'M01-00-02';
    expect(resolveStartLessonTitle([], unresolvedId)).toBe(de.start.lessonTitleFallback);
    expect(resolveStartLessonTitle([], unresolvedId)).not.toBe(unresolvedId);
  });

  it('does not treat id-as-title module entries as hydrated titles', () => {
    const unresolvedId = 'M01-00-02';
    const modules = [{
      id: 'M01', title: 'Modul 1', subModules: [{ id: 'M01-00', title: 'Grundlagen', lessons: [{ id: unresolvedId, title: unresolvedId }] }],
    }] as unknown as ModuleListEntry[];
    expect(isHydratingLessonTitle(unresolvedId, unresolvedId)).toBe(true);
    expect(resolvePublishedLessonDisplayTitle(unresolvedId, unresolvedId)).toBe(de.start.lessonTitleFallback);
    expect(resolveStartLessonTitle(modules, unresolvedId)).toBe(de.start.lessonTitleFallback);
    expect(resolveStartLessonTitle(modules, unresolvedId)).not.toBe(unresolvedId);
  });

  it('prefers the resolved published title when available', () => {
    const modules = [{
      id: 'M01', title: 'Modul 1', subModules: [{ id: 'M01-00', title: 'Grundlagen', lessons: [{ id: 'M01-00-02', title: 'Variablen verstehen' }] }],
    }] as unknown as ModuleListEntry[];
    expect(resolveStartLessonTitle(modules, 'M01-00-02')).toBe('Variablen verstehen');
  });
});
