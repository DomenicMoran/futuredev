import type { CueBlock, CueSection } from '@futuredev/content-schema';
import { de } from '../i18n/de.js';

const SECTION_HEADINGS: Record<CueSection, string> = {
  body: de.lesson.readTab,
  terms: de.lesson.jumpTerms,
  example: de.lesson.jumpExample,
  task: de.lesson.jumpTask,
  faq: de.lesson.jumpFaq,
};

/** Zeilenumbrüche und TTS-Zeilenwechsel zu einem lesbaren Einzeiler. */
export function normalizeSpeechPreview(text: string): string {
  return text
    .replace(/\s*\.\s+(?=[a-zäöüß])/gi, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kurzer Titel für eine Sprungmarke in der Kapitelliste. */
export function speechPreview(text: string, maxLength = 72): string {
  const normalized = normalizeSpeechPreview(text);
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 24 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

export function sectionHeading(section: CueSection | undefined): string {
  return SECTION_HEADINGS[section ?? 'body'];
}

export function chapterRowLabel(block: CueBlock, speechTexts: readonly string[] | undefined): string {
  if (speechTexts === undefined) {
    return de.player.chapterLoading;
  }
  const raw = speechTexts[block.index];
  if (raw && raw.trim().length > 0) {
    return speechPreview(raw);
  }
  if (speechTexts.length > 0) {
    return de.lesson.chapterSectionFallback;
  }
  return block.speaker === 'A' ? de.lesson.speakerA : de.lesson.speakerB;
}

/** true, wenn der Abschnitt gegenüber dem vorherigen Block wechselt. */
export function isSectionBoundary(block: CueBlock, previous: CueBlock | undefined): boolean {
  if (!previous) return true;
  const currentSection = block.section ?? 'body';
  const previousSection = previous.section ?? 'body';
  return currentSection !== previousSection;
}
