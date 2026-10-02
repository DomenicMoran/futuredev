import { describe, expect, it } from 'vitest';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { createLessonSearchEntry, searchLessonEntries } from './lessonSearch.js';

describe('lesson search index', () => {
  it('finds lesson titles, topics, terms, FAQ and speech text without dropping lessons', () => {
    const fixture = makeValidLesson();
    const lesson = {
      ...fixture,
      id: 'M01-00-01',
      title: 'Titel für Suche',
      terms: [{ term: 'Verschlüsselung', definition: 'Daten werden geschützt.' }],
      faq: [{ question: 'Was ist ein Suchbegriff?', answer: 'Der Begriff wird im FAQ-Text gefunden. Die Antwort enthält zwei Sätze.' }, ...fixture.faq.slice(1)],
      speechBlocks: fixture.speechBlocks.map((block, index) => index === 0 ? { ...block, text: 'Ein Thema aus dem gesprochenen Inhalt.' } : block),
    };
    const entry = createLessonSearchEntry(lesson.id, lesson.title, 'Modul Datenschutz', 'Sicherheit', lesson);
    const index = [entry];
    expect(searchLessonEntries(index, 'verschluesselung')).toHaveLength(1);
    expect(searchLessonEntries(index, 'modul datenschutz')).toHaveLength(1);
    expect(searchLessonEntries(index, 'suchbegriff')).toHaveLength(1);
    expect(searchLessonEntries(index, 'gesprochenen inhalt')).toHaveLength(1);
    expect(searchLessonEntries(index, 'does-not-exist')).toHaveLength(0);
    expect(searchLessonEntries(index, '')).toHaveLength(1);
  });
});
