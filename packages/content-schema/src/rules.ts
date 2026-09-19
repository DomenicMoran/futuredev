import type { Lesson } from './lesson.js';

export interface RuleViolation {
  rule: string;
  message: string;
}

/** Jede Quizfrage braucht genau eine richtige Option. */
export function checkExactlyOneCorrectOption(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  lesson.quiz.forEach((q, i) => {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      violations.push({
        rule: 'genau-eine-richtige-option',
        message: `${lesson.id}: Frage ${i + 1} hat ${correctCount} richtige Optionen, erwartet 1`,
      });
    }
  });
  return violations;
}

/**
 * Die längste Option darf höchstens in 40 Prozent der Fragen einer Lektion die
 * richtige sein (feedback_quiz_laengste_option_verraet_die_antwort). Bei Gleichstand
 * der Länge zählt jede längste Option als "die längste" für diese Frage.
 */
export function checkLongestOptionNotAlwaysCorrect(lesson: Lesson): RuleViolation[] {
  if (lesson.quiz.length === 0) return [];
  let longestIsCorrectCount = 0;
  for (const q of lesson.quiz) {
    const maxLength = Math.max(...q.options.map((o) => o.text.length));
    const longestOptions = q.options.filter((o) => o.text.length === maxLength);
    if (longestOptions.some((o) => o.isCorrect)) {
      longestIsCorrectCount += 1;
    }
  }
  const share = longestIsCorrectCount / lesson.quiz.length;
  if (share > 0.4) {
    return [
      {
        rule: 'laengste-option-nicht-immer-richtig',
        message: `${lesson.id}: längste Option ist in ${Math.round(share * 100)}% der Fragen richtig, erlaubt sind höchstens 40%`,
      },
    ];
  }
  return [];
}

/** Der Kernsatz (isKeySentence) muss genau einmal je Lektion vorkommen. */
export function checkKeySentenceExactlyOnce(lesson: Lesson): RuleViolation[] {
  const count = lesson.speechBlocks.filter((b) => b.isKeySentence).length;
  if (count !== 1) {
    return [
      {
        rule: 'kernsatz-genau-einmal',
        message: `${lesson.id}: ${count} Sprechblöcke mit isKeySentence, erwartet genau 1`,
      },
    ];
  }
  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textContainsWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'iu');
  return pattern.test(text);
}

function lessonFullText(lesson: Lesson): string {
  const parts = [
    lesson.title,
    ...lesson.speechBlocks.map((b) => b.text),
    lesson.practiceExample.text,
    lesson.practiceTask.task,
    lesson.practiceTask.expectation,
    ...lesson.quiz.map((q) => q.question),
  ];
  return parts.join('\n');
}

/**
 * Begriffsreihenfolge: kein im Text vorkommender Glossarbegriff darf aus einer
 * Lektion stammen, die keine Voraussetzung dieser Lektion ist (und auch nicht aus
 * dieser Lektion selbst). Wortgrenzen beachtet, Groß- und Kleinschreibung ignoriert.
 * Braucht die vollständige Lektionsliste, um zu wissen, wann welcher Begriff
 * eingeführt wurde.
 */
export function checkTermOrder(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const allowedLessonIds = new Set([lesson.id, ...lesson.prerequisites]);
  const ownTerms = new Set(lesson.terms.map((t) => t.term.toLowerCase()));
  const text = lessonFullText(lesson);

  for (const other of allLessons) {
    if (allowedLessonIds.has(other.id)) continue;
    for (const t of other.terms) {
      if (ownTerms.has(t.term.toLowerCase())) continue; // in dieser Lektion selbst neu definiert
      if (textContainsWord(text, t.term)) {
        violations.push({
          rule: 'begriffsreihenfolge',
          message: `${lesson.id}: benutzt Begriff "${t.term}" aus ${other.id}, das keine Voraussetzung ist`,
        });
      }
    }
  }
  return violations;
}

/**
 * Ablenker müssen aus demselben Themenbereich stammen. Heuristik: keine Option
 * darf wörtlich ein Glossarbegriff aus einem anderen Modul (erste drei Zeichen der
 * Kennung, z. B. "M03") sein. Grenze dieser Heuristik: sie erkennt nur wörtliche
 * Begriffsübernahmen, keine sinngemäßen Ablenker aus einem fremden Bereich und
 * keine themenfremden, aber begriffsfreien Ablenker (etwa erfundene Fantasienamen).
 */
export function checkDistractorsSameArea(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const ownModule = lesson.id.slice(0, 3);
  const foreignTerms = new Map<string, string>(); // term (lower) -> lesson id
  for (const other of allLessons) {
    if (other.id.slice(0, 3) === ownModule) continue;
    for (const t of other.terms) {
      foreignTerms.set(t.term.toLowerCase(), other.id);
    }
  }

  lesson.quiz.forEach((q, i) => {
    for (const option of q.options) {
      const sourceLessonId = foreignTerms.get(option.text.trim().toLowerCase());
      if (sourceLessonId) {
        violations.push({
          rule: 'ablenker-aus-demselben-bereich',
          message: `${lesson.id}: Frage ${i + 1} nutzt Option "${option.text}", ein Begriff aus fremdem Modul ${sourceLessonId}`,
        });
      }
    }
  });
  return violations;
}

/** Führt alle Regeln über eine Lektion im Kontext aller Lektionen aus. */
export function checkAllRules(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  return [
    ...checkExactlyOneCorrectOption(lesson),
    ...checkLongestOptionNotAlwaysCorrect(lesson),
    ...checkKeySentenceExactlyOnce(lesson),
    ...checkTermOrder(lesson, allLessons),
    ...checkDistractorsSameArea(lesson, allLessons),
  ];
}
