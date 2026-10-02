import type {
  BookmarkRow,
  CareerChecklistRow,
  Database,
  ExamResultRow,
  NoteRow,
  PlaylistItemRow,
  PlaylistRow,
  PortfolioItemRow,
  ProgressRow,
  ReviewRow,
  LegacyReviewArchiveRow,
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
  const legacyReviewArchive = new Map<string, LegacyReviewArchiveRow>();
  const reviewKey = (sourceLessonId: string, questionId: string) => `${sourceLessonId}\u0000${questionId}`;
  const notes = new Map<string, NoteRow>();
  const bookmarks = new Map<string, BookmarkRow>();
  const settings = new Map<string, string>();
  const portfolioItems = new Map<string, PortfolioItemRow>();
  const careerChecklist = new Map<string, CareerChecklistRow>();
  const examResults = new Map<string, ExamResultRow>();
  const playlists = new Map<string, PlaylistRow>();
  const playlistItems = new Map<string, PlaylistItemRow[]>();
  let transactionTail: Promise<void> = Promise.resolve();

  const database: Database = {
    async clearPersonalData() {
      for (const map of [progress, reviews, legacyReviewArchive, notes, bookmarks, settings, portfolioItems, careerChecklist, examResults, playlists, playlistItems]) map.clear();
    },
    async transaction(work) {
      let release!: () => void;
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const snapshots = [progress, reviews, legacyReviewArchive, notes, bookmarks, settings, portfolioItems, careerChecklist, examResults, playlists, playlistItems].map((map) => [...map.entries()].map(([k, v]) => [k, Array.isArray(v) ? v.map((item) => ({ ...item })) : v] as const));
      try { return await work(transactionView); }
      catch (error) {
        const maps = [progress, reviews, legacyReviewArchive, notes, bookmarks, settings, portfolioItems, careerChecklist, examResults, playlists, playlistItems] as Map<unknown, unknown>[];
        maps.forEach((map, i) => { map.clear(); for (const [k, v] of snapshots[i] ?? []) map.set(k, v); });
        throw error;
      } finally { release(); }
    },
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

    async getReview(sourceLessonId, questionId) {
      return reviews.get(reviewKey(sourceLessonId, questionId));
    },
    async upsertReview(row) {
      reviews.set(reviewKey(row.sourceLessonId, row.questionId), row);
    },
    async listReviews() {
      return [...reviews.values()];
    },
    async listLegacyReviewArchive() {
      return [...legacyReviewArchive.values()];
    },
    async upsertLegacyReviewArchive(row) {
      if (!legacyReviewArchive.has(row.id)) legacyReviewArchive.set(row.id, row);
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

    async listPlaylists() {
      return [...playlists.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async createPlaylist(name) {
      const now = new Date().toISOString();
      const id = `pl_test_${playlists.size + 1}`;
      const row: PlaylistRow = { id, name, createdAt: now, updatedAt: now };
      playlists.set(id, row);
      playlistItems.set(id, []);
      return row;
    },
    async restorePlaylist(row, items) {
      playlists.set(row.id, row);
      playlistItems.set(row.id, items.map((item) => ({ ...item })));
    },
    async renamePlaylist(id, name) {
      const row = playlists.get(id);
      if (!row) return;
      const now = new Date().toISOString();
      playlists.set(id, { ...row, name, updatedAt: now });
    },
    async deletePlaylist(id) {
      playlists.delete(id);
      playlistItems.delete(id);
    },
    async listPlaylistItems(playlistId) {
      return [...(playlistItems.get(playlistId) ?? [])].sort((a, b) => a.position - b.position);
    },
    async addPlaylistItem(playlistId, lessonId) {
      const items = playlistItems.get(playlistId) ?? [];
      if (items.some((i) => i.lessonId === lessonId)) return;
      const position = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;
      items.push({ playlistId, lessonId, position });
      playlistItems.set(playlistId, items);
      const pl = playlists.get(playlistId);
      if (pl) {
        const now = new Date().toISOString();
        playlists.set(playlistId, { ...pl, updatedAt: now });
      }
    },
    async removePlaylistItem(playlistId, lessonId) {
      const items = (playlistItems.get(playlistId) ?? []).filter((i) => i.lessonId !== lessonId);
      playlistItems.set(playlistId, items);
    },
  };

  // A distinct transaction facade lets nested JOIN calls be distinguished
  // from concurrent top-level calls while all other operations share maps.
  const transactionView = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'transaction') return <T>(work: (tx: Database) => Promise<T>) => work(transactionView);
      return Reflect.get(target, property, receiver);
    },
  });
  return database;
}
