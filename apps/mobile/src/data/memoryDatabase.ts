import type {
  BookmarkRow,
  CareerChecklistRow,
  Database,
  ExamResultRow,
  NoteRow,
  PortfolioItemRow,
  ProgressRow,
  ReviewRow,
  SettingRow,
} from './types.js';
import { SCHEMA_VERSION } from './types.js';

/**
 * Reine JavaScript-Ablage, erfuellt dieselbe {@link Database}-Schnittstelle wie
 * `sqliteDatabase.ts`. Damit laufen Vitest-Tests fuer Datenzugriff,
 * Export/Import und Zusammenfuehrung ohne natives SQLite (Technikvorgabe 3).
 */
export function createMemoryDatabase(): Database {
  const progress = new Map<string, ProgressRow>();
  const reviews = new Map<string, ReviewRow>();
  const notes = new Map<string, NoteRow>();
  const bookmarks = new Map<string, BookmarkRow>();
  const settings = new Map<string, string>();
  const portfolioItems = new Map<string, PortfolioItemRow>();
  const careerChecklist = new Map<string, CareerChecklistRow>();
  const examResults = new Map<string, ExamResultRow>();

  return {
    async init() {
      if (!settings.has('schema_version')) {
        settings.set('schema_version', String(SCHEMA_VERSION));
      }
    },

    async getSchemaVersion() {
      return Number(settings.get('schema_version') ?? '0');
    },

    async getProgress(lessonId) {
      return progress.get(lessonId);
    },
    async upsertProgress(row) {
      progress.set(row.lessonId, row);
    },
    async listProgress() {
      return [...progress.values()];
    },

    async getReview(lessonId) {
      return reviews.get(lessonId);
    },
    async upsertReview(row) {
      reviews.set(row.lessonId, row);
    },
    async listReviews() {
      return [...reviews.values()];
    },

    async listNotes(lessonId) {
      const all = [...notes.values()];
      return lessonId ? all.filter((n) => n.lessonId === lessonId) : all;
    },
    async upsertNote(row) {
      notes.set(row.id, row);
    },
    async deleteNote(id) {
      notes.delete(id);
    },

    async listBookmarks(lessonId) {
      const all = [...bookmarks.values()];
      return lessonId ? all.filter((b) => b.lessonId === lessonId) : all;
    },
    async upsertBookmark(row) {
      bookmarks.set(row.id, row);
    },
    async deleteBookmark(id) {
      bookmarks.delete(id);
    },

    async getSetting(key) {
      return settings.get(key);
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
    async listSettings() {
      return [...settings.entries()].map(([key, value]): SettingRow => ({ key, value }));
    },

    async listPortfolioItems() {
      return [...portfolioItems.values()];
    },
    async upsertPortfolioItem(row) {
      portfolioItems.set(row.id, row);
    },

    async listCareerChecklist() {
      return [...careerChecklist.values()];
    },
    async upsertCareerChecklistItem(row) {
      careerChecklist.set(row.item, row);
    },

    async listExamResults(scope) {
      const all = [...examResults.values()];
      return scope ? all.filter((e) => e.scope === scope) : all;
    },
    async insertExamResult(row) {
      examResults.set(row.id, row);
    },
  };
}
