import type { Lesson } from '@futuredev/content-schema';

export interface LessonSearchEntry {
  id: string;
  title: string;
  moduleTitle: string;
  submoduleTitle: string;
  text: string;
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function createLessonSearchEntry(
  id: string,
  title: string,
  moduleTitle: string,
  submoduleTitle: string,
  lesson: Lesson | null,
): LessonSearchEntry {
  const text = lesson
    ? [
        lesson.id,
        lesson.title,
        ...lesson.terms.flatMap((term) => [term.term, term.definition]),
        lesson.practiceExample.text,
        lesson.practiceTask.task,
        lesson.practiceTask.expectation,
        ...lesson.practiceTask.checklist,
        ...lesson.faq.flatMap((faq) => [faq.question, faq.answer]),
        ...lesson.speechBlocks.map((block) => block.text),
      ].join(' ')
    : '';
  return {
    id,
    title,
    moduleTitle,
    submoduleTitle,
    text: normalizeSearchText(`${id} ${title} ${moduleTitle} ${submoduleTitle} ${text}`),
  };
}

export function searchLessonEntries(entries: readonly LessonSearchEntry[], query: string): LessonSearchEntry[] {
  const term = normalizeSearchText(query.trim());
  if (!term) return [...entries];
  return entries.filter((entry) => entry.text.includes(term));
}
