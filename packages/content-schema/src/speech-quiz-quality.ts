import type { Lesson } from './lesson.js';

export interface RuleViolation {
  rule: string;
  message: string;
  severity?: 'error' | 'warning';
}

const META_DISTRACTOR_RE = /\(häufige Verwechslung in diesem Themenfeld\)/i;

/** Bekannte Abkürzungen vor Punkt — kein TTS-Satzbruch. */
const ABBREV_BEFORE_DOT = new Set([
  'bzw',
  'usw',
  'etc',
  'ca',
  'ggf',
  'evtl',
  'vgl',
  'inkl',
  'nr',
  'str',
  'z',
]);

/**
 * Heuristik: Punkt mitten im Satz, typisch nach fehlerhafter Zeilenumbruch-Konvertierung
 * ("es. ist", "ohne. bewegliche"). Buchstabierte Einzelbuchstaben ("C.") und "z. B." ausgenommen.
 */
export function hasTtsMidSentenceBreak(text: string): boolean {
  const re =
    /(?<![A-ZÄÖÜ])(?<![\p{L}\p{N}_])([a-zäöüß]{2,})\.\s+([a-zäöüß][\p{L}\p{N}äöüß-]*)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const wordBefore = match[1] ?? '';
    if (ABBREV_BEFORE_DOT.has(wordBefore.toLowerCase())) continue;
    return true;
  }
  if (/,\s*\./.test(text)) return true;
  return false;
}

export function checkSpeechBlockTtsBreaks(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  lesson.speechBlocks.forEach((b, i) => {
    if (hasTtsMidSentenceBreak(b.text)) {
      violations.push({
        rule: 'tts-satzbruch-speechblock',
        message: `${lesson.id}: speechBlocks[${i}] enthält einen wahrscheinlichen TTS-Satzbruch: "${b.text.slice(0, 80)}…"`,
      });
    }
  });
  for (const f of lesson.faq) {
    if (hasTtsMidSentenceBreak(f.question) || hasTtsMidSentenceBreak(f.answer)) {
      violations.push({
        rule: 'tts-satzbruch-faq',
        message: `${lesson.id}: FAQ-Eintrag mit wahrscheinlichem TTS-Satzbruch`,
      });
    }
  }
  return violations;
}

export function checkQuizMetaDistractors(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  lesson.quiz.forEach((q, qi) => {
    q.options.forEach((o, oi) => {
      if (META_DISTRACTOR_RE.test(o.text)) {
        violations.push({
          rule: 'quiz-meta-ablenker',
          message: `${lesson.id}: Frage ${qi + 1}, Option ${oi + 1} nutzt Platzhalter-Ablenker`,
        });
      }
    });
  });
  return violations;
}

export function checkDuplicateQuizStems(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const seen = new Map<string, number>();
  lesson.quiz.forEach((q, i) => {
    const key = q.question.trim().toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      violations.push({
        rule: 'quiz-doppelter-stamm',
        message: `${lesson.id}: Frage ${i + 1} wiederholt den Stamm von Frage ${prev + 1}`,
      });
    } else {
      seen.set(key, i);
    }
  });
  return violations;
}
