import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledManifest, getBundledLesson } from '../content/bundledData.js';
import { loadMasteryBank } from './content.js';
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), lesson: vi.fn() }));
vi.mock('../content/contentFs.js', () => ({ getContentFs: async () => ({}) }));
vi.mock('../content/generation.js', () => ({ loadContentSnapshot: mocks.snapshot }));
vi.mock('../content/lessonLoader.js', () => ({ loadLesson: mocks.lesson }));
beforeEach(() => {
  vi.clearAllMocks();
});
describe('pinned mastery content', () => {
  it('uses the complete validated bundle without rereading every file', async () => {
    mocks.snapshot.mockResolvedValue({ manifest: bundledManifest });
    expect(await loadMasteryBank()).toHaveLength(2375);
    expect(mocks.lesson).not.toHaveBeenCalled();
  });
  it('loads updates from the pinned generation rather than stale bundled questions', async () => {
    const entry = bundledManifest.lessons[0];
    if (!entry) throw new Error('missing fixture');
    const lesson = getBundledLesson(entry.id);
    if (!lesson) throw new Error('missing lesson');
    const snapshot = { manifest: { lessons: [{ ...entry, sha256: 'changed' }] } };
    mocks.snapshot.mockResolvedValue(snapshot);
    mocks.lesson.mockResolvedValue(lesson);
    expect(await loadMasteryBank()).toHaveLength(lesson.quiz.length);
    expect(mocks.lesson).toHaveBeenCalledWith({}, entry.id, { snapshot });
  });
  it('fails closed on missing updated content, never silently shortens a complete examination', async () => {
    mocks.snapshot.mockResolvedValue({ manifest: { lessons: [{ id: 'new', sha256: 'changed' }] } });
    mocks.lesson.mockResolvedValue(null);
    await expect(loadMasteryBank()).rejects.toThrow('new');
  });
});
