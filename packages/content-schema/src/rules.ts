import type { Lesson } from './lesson.js';
import { countWords, splitSentences } from './text-metrics.js';

export interface RuleViolation {
  rule: string;
  message: string;
  // Fehlt severity, gilt der Verstoss als Fehler (Rueckgabewert 1). 'warning'
  // wird von cli-validate.ts ausgegeben, zaehlt aber nicht als Fehler.
  severity?: 'error' | 'warning';
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

/**
 * Konsistenzregel (AP-4.1, inhaltsformat.md): der Block mit isKeySentence:
 * true muss role "key" tragen, damit Textrolle und Audio-Kapitelmarke
 * (section "body" aus role "key") und der Kernsatz-Zeiger im Player
 * dieselbe Wahrheit meinen.
 */
export function checkKeySentenceHasKeyRole(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  lesson.speechBlocks.forEach((b, i) => {
    if (b.isKeySentence && b.role !== 'key') {
      violations.push({
        rule: 'kernsatz-hat-rolle-key',
        message: `${lesson.id}: Block ${i} hat isKeySentence:true, aber role "${b.role}" statt "key"`,
      });
    }
    if (!b.isKeySentence && b.role === 'key') {
      violations.push({
        rule: 'kernsatz-hat-rolle-key',
        message: `${lesson.id}: Block ${i} hat role "key", aber isKeySentence ist nicht true`,
      });
    }
  });
  return violations;
}

/**
 * FAQ-Konsistenz (AP-4.1, AW-045): die role:"faq"-Bloecke am Lektionsende
 * muessen die Eintraege aus dem Feld faq wortgleich widerspiegeln, je Eintrag
 * ein B-Block mit der Frage, danach ein A-Block mit der Antwort, damit Text
 * und Audio (vertont aus genau diesen Bloecken) gleich sind.
 */
export function checkFaqBlocksMatchEntries(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const faqBlocks = lesson.speechBlocks.filter((b) => b.role === 'faq');
  const nonFaqAfterFaq = (() => {
    const firstFaqIndex = lesson.speechBlocks.findIndex((b) => b.role === 'faq');
    if (firstFaqIndex === -1) return false;
    return lesson.speechBlocks.slice(firstFaqIndex).some((b) => b.role !== 'faq');
  })();

  if (nonFaqAfterFaq) {
    violations.push({
      rule: 'faq-bloecke-am-ende',
      message: `${lesson.id}: role:"faq"-Blöcke müssen zusammenhängend am Ende der Lektion stehen`,
    });
  }

  if (faqBlocks.length !== lesson.faq.length * 2) {
    violations.push({
      rule: 'faq-bloecke-spiegeln-eintraege',
      message: `${lesson.id}: ${faqBlocks.length} role:"faq"-Blöcke, erwartet ${lesson.faq.length * 2} (2 je faq-Eintrag)`,
    });
    return violations;
  }

  lesson.faq.forEach((entry, i) => {
    const questionBlock = faqBlocks[i * 2];
    const answerBlock = faqBlocks[i * 2 + 1];
    if (questionBlock === undefined || answerBlock === undefined) return;
    if (questionBlock.speaker !== 'B' || questionBlock.text !== entry.question) {
      violations.push({
        rule: 'faq-bloecke-spiegeln-eintraege',
        message: `${lesson.id}: faq-Eintrag ${i + 1} erwartet B-Block mit Text "${entry.question}"`,
      });
    }
    if (answerBlock.speaker !== 'A' || answerBlock.text !== entry.answer) {
      violations.push({
        rule: 'faq-bloecke-spiegeln-eintraege',
        message: `${lesson.id}: faq-Eintrag ${i + 1} erwartet A-Block mit Text "${entry.answer}"`,
      });
    }
  });

  return violations;
}

/**
 * Begriffsliste (AP-4.1): alle role:"terms_list"-Blöcke zusammen müssen jeden
 * Begriff aus terms nennen (Wortgrenze, Groß/Klein egal). Mehrere Blöcke sind
 * erlaubt (je Begriff ein Block ist der übliche Stil dieser Lektionen).
 */
export function checkTermsListCoversTerms(lesson: Lesson): RuleViolation[] {
  if (lesson.terms.length === 0) return [];
  const listBlocks = lesson.speechBlocks.filter((b) => b.role === 'terms_list');
  if (listBlocks.length === 0) {
    return [
      {
        rule: 'begriffsliste-vollstaendig',
        message: `${lesson.id}: kein Block mit role "terms_list", obwohl terms nicht leer ist`,
      },
    ];
  }
  const listText = listBlocks.map((b) => b.text).join('\n');
  const violations: RuleViolation[] = [];
  for (const t of lesson.terms) {
    if (!textContainsWord(listText, t.term)) {
      violations.push({
        rule: 'begriffsliste-vollstaendig',
        message: `${lesson.id}: Begriff "${t.term}" fehlt in den role:"terms_list"-Blöcken`,
      });
    }
  }
  return violations;
}

/**
 * Regel 13 (inhaltsformat.md): je Begriff aus terms existiert mindestens ein
 * Block mit role "image" oder "example", der den Begriff (Wortstamm,
 * Groß/Klein egal, Wortgrenze am Anfang) nennt. Eine Definition ohne ein
 * solches Beispiel ist ein Fehler.
 */
export function checkTermsHaveImageOrExample(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const candidateBlocks = lesson.speechBlocks.filter((b) => b.role === 'image' || b.role === 'example');
  for (const t of lesson.terms) {
    const hasBlock = candidateBlocks.some((b) => textStartsWithWordStem(b.text, t.term));
    if (!hasBlock) {
      violations.push({
        rule: 'begriff-mit-beispiel',
        message: `${lesson.id}: kein Block mit role "image" oder "example" nennt den Begriff "${t.term}"`,
      });
    }
  }
  return violations;
}

/**
 * Task 2c (AP-4.1): eine Definition ohne Beispiel ist ein Fehler. Jeder Block
 * mit role "term" muss innerhalb der nächsten drei Blöcke (Index i+1 bis i+3)
 * von einem Block mit role "example" oder "image" gefolgt werden.
 */
export function checkTermBlockFollowedByExample(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const blocks = lesson.speechBlocks;
  blocks.forEach((b, i) => {
    if (b.role !== 'term') return;
    const window = blocks.slice(i + 1, i + 4);
    const hasFollowUp = window.some((w) => w.role === 'example' || w.role === 'image');
    if (!hasFollowUp) {
      violations.push({
        rule: 'definition-mit-beispiel-in-reichweite',
        message: `${lesson.id}: Block ${i} (role "term") hat innerhalb der nächsten drei Blöcke kein "example" oder "image"`,
      });
    }
  });
  return violations;
}

/**
 * Regel 14 (inhaltsformat.md, AW-046): mittlere Satzlänge über alle
 * blocks[].text unter 20 Wörtern, kein einzelner Satz über 35 Wörter.
 * Satzzerlegung siehe text-metrics.ts (Heuristik gegen buchstabierte
 * Abkürzungen wie "CPU. C, P, U." oder "z. B.").
 */
export function checkSentenceLength(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const sentences = lesson.speechBlocks.flatMap((b) => splitSentences(b.text));
  if (sentences.length === 0) return violations;

  const lengths = sentences.map((s) => countWords(s));
  const average = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  if (average >= 20) {
    violations.push({
      rule: 'mittlere-satzlaenge',
      message: `${lesson.id}: mittlere Satzlänge ${average.toFixed(1)} Wörter, erlaubt sind unter 20`,
    });
  }

  lengths.forEach((len, i) => {
    if (len > 35) {
      violations.push({
        rule: 'maximale-satzlaenge',
        message: `${lesson.id}: Satz "${sentences[i]}" hat ${len} Wörter, erlaubt sind höchstens 35`,
      });
    }
  });

  return violations;
}

// Erste zwei Ziffern eines semver-Strings ("0.2.0" -> [0,2,0]) fuer den
// Versionsvergleich der Mindestumfang-Regel.
function parseSemver(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function semverGte(a: string, b: string): boolean {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch >= bPatch;
}

const MINIMUM_WORD_COUNT = 2500;
// Ab dieser Manifest-Version wird Unterschreitung zum Fehler (Task 2d,
// AP-4.1): vorher ist es eine Warnung, solange M01-01-01 selbst noch darunter
// liegt (siehe content/README.md).
const MINIMUM_WORD_COUNT_ENFORCED_FROM = '0.2.0';

// Benannte Ausnahmeliste (AP-4.2, Auftrag Punkt 5): Lektionen, die trotz
// Manifest-Version 0.2.0 (und damit scharf gestellter Mindestumfang-Regel)
// unter 2500 Wörtern bleiben duerfen, mit Begruendung. Nur M01-01-01 ist
// hier eingetragen: sie wurde vor AW-045 geschrieben und wird in der
// Audio-Welle erweitert, statt jetzt kuenstlich mit Fuellsaetzen gestreckt zu
// werden. Jede neue Lektion muss den Mindestumfang von Anfang an einhalten.
const MINIMUM_WORD_COUNT_EXCEPTIONS: Record<string, string> = {
  'M01-01-01': 'vor AW-045 geschrieben, wird in der Audio-Welle erweitert',
};

/**
 * Task 2d (AP-4.1): Mindestumfang 2500 Wörter je Lektion, gezählt über
 * speechBlocks[].text (der tatsächlich gesprochene Text). Warnung statt
 * Fehler, solange die Manifest-Version unter 0.2.0 liegt, danach Fehler,
 * außer für eine Lektion aus der benannten Ausnahmeliste.
 */
export function checkMinimumWordCount(lesson: Lesson, manifestVersion: string): RuleViolation[] {
  const words = lesson.speechBlocks.reduce((sum, b) => sum + countWords(b.text), 0);
  if (words >= MINIMUM_WORD_COUNT) return [];
  const exceptionReason = MINIMUM_WORD_COUNT_EXCEPTIONS[lesson.id];
  const enforced = semverGte(manifestVersion, MINIMUM_WORD_COUNT_ENFORCED_FROM);
  if (exceptionReason !== undefined) {
    return [
      {
        rule: 'mindestumfang-2500-woerter',
        message: `${lesson.id}: ${words} Wörter unter dem Mindestumfang von ${MINIMUM_WORD_COUNT}, Ausnahme: ${exceptionReason}`,
        severity: 'warning',
      },
    ];
  }
  return [
    {
      rule: 'mindestumfang-2500-woerter',
      message: `${lesson.id}: ${words} Wörter unter dem Mindestumfang von ${MINIMUM_WORD_COUNT} (Manifest-Version ${manifestVersion})`,
      severity: enforced ? 'error' : 'warning',
    },
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `\b` kennt nur ASCII-Wortzeichen: bei einem Begriff mit Umlaut ("öffentliche
// Adresse", "Änderung") liegt die Grenze zwischen Nicht-Wort und Umlaut nicht
// dort, wo \b sie erwartet, und der Treffer geht verloren (feedback der
// Autoren, AP-4.2). Ersetzt durch Lookaround auf \p{L}/\p{N} (Unicode-fähig
// mit Flag 'u'), das Buchstaben und Ziffern jeder Sprache als Wortzeichen
// behandelt.
const WORD_CHAR = '\\p{L}\\p{N}';

// Ein Kürzel wie "POST" oder "GET" ist ein eigenes, grossgeschriebenes Wort
// (die HTTP-Methode), das mit einem gewoehnlichen deutschen Wort gleichen
// Namens kollidieren kann ("Post" als Anrede fuer den Postboten). Groß/Klein
// egal ist fuer normale Begriffe richtig, wuerde hier aber einen falschen
// Treffer erzeugen. Kuerzel (rein grossgeschriebene Buchstaben/Ziffern/Bindestrich,
// mindestens zwei Zeichen) werden deshalb Gross-/Kleinschreibung-sensitiv
// gesucht, alle anderen Begriffe weiterhin ohne Ruecksicht auf Gross-/
// Kleinschreibung.
function isAcronym(word: string): boolean {
  return /^[A-Z][A-Z0-9-]+$/.test(word);
}

function textContainsWord(text: string, word: string): boolean {
  const flags = isAcronym(word) ? 'u' : 'iu';
  const pattern = new RegExp(`(?<![${WORD_CHAR}])${escapeRegExp(word)}(?![${WORD_CHAR}])`, flags);
  return pattern.test(text);
}

/**
 * Wortstamm-Suche (Regel 13): der Begriff muss am Wortanfang stehen
 * (Wortgrenze davor), darf aber mit weiteren Buchstaben enden (z. B.
 * "Festplatten" erfuellt den Begriff "Festplatte"). Groß/Klein egal, außer
 * bei einem Kürzel (siehe `isAcronym`).
 */
function textStartsWithWordStem(text: string, word: string): boolean {
  const flags = isAcronym(word) ? 'u' : 'iu';
  const pattern = new RegExp(`(?<![${WORD_CHAR}])${escapeRegExp(word)}`, flags);
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
/**
 * Transitive Voraussetzungshülle: die Menge aller Lektionen, die über
 * `prerequisites` erreichbar sind (direkt oder über Ketten), plus die
 * Lektion selbst. Vorher prüfte checkTermOrder nur die direkt gelisteten
 * `prerequisites`, weshalb Autoren jede indirekte Voraussetzung zusätzlich
 * einzeln eintragen mussten (feedback der Autoren, AP-4.2). Setzt
 * `checkPrerequisitesAreEarlier` voraus, um Endlosschleifen bei einem Zyklus
 * auszuschließen; robust dagegen zusätzlich über `visited`.
 */
function transitivePrerequisites(lessonId: string, allLessons: Lesson[]): Set<string> {
  const byId = new Map(allLessons.map((l) => [l.id, l]));
  const visited = new Set<string>([lessonId]);
  const stack = [lessonId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    const lesson = byId.get(current);
    if (!lesson) continue;
    for (const prereq of lesson.prerequisites) {
      if (!visited.has(prereq)) {
        visited.add(prereq);
        stack.push(prereq);
      }
    }
  }
  return visited;
}

/** Voraussetzungen dürfen nur auf tatsächlich vorhandene Lektionen verweisen. */
export function checkPrerequisitesExist(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  const ids = new Set(allLessons.map((l) => l.id));
  const violations: RuleViolation[] = [];
  for (const p of lesson.prerequisites) {
    if (!ids.has(p)) {
      violations.push({
        rule: 'voraussetzung-existiert',
        message: `${lesson.id}: Voraussetzung "${p}" verweist auf keine vorhandene Lektion`,
      });
    }
  }
  return violations;
}

/**
 * Lernpfad-Reihenfolge bleibt die Kennungsreihenfolge: eine Lektion setzt nie
 * eine spätere oder gleiche Kennung voraus. Kennungen haben feste Breite
 * (`M00-00-00`), daher entspricht String-Vergleich der Reihenfolge.
 */
export function checkPrerequisitesAreEarlier(lesson: Lesson): RuleViolation[] {
  const violations: RuleViolation[] = [];
  for (const p of lesson.prerequisites) {
    if (p >= lesson.id) {
      violations.push({
        rule: 'voraussetzung-liegt-frueher',
        message: `${lesson.id}: Voraussetzung "${p}" ist keine frühere Kennung als die Lektion selbst`,
      });
    }
  }
  return violations;
}

/**
 * Keine Zyklen in den Voraussetzungsketten. Wird durch
 * `checkPrerequisitesAreEarlier` bereits ausgeschlossen (eine streng
 * aufsteigende Kette kann nicht zu sich selbst zurückführen), bleibt aber als
 * eigene, von dieser Annahme unabhängige Prüfung bestehen (Task 3,
 * inhaltsformat.md).
 */
export function checkNoPrerequisiteCycles(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  const byId = new Map(allLessons.map((l) => [l.id, l]));
  const visiting = new Set<string>();

  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    const current = byId.get(id);
    if (!current) return false;
    visiting.add(id);
    for (const prereq of current.prerequisites) {
      if (hasCycle(prereq)) return true;
    }
    visiting.delete(id);
    return false;
  }

  if (hasCycle(lesson.id)) {
    return [
      {
        rule: 'keine-zyklen',
        message: `${lesson.id}: Voraussetzungskette enthält einen Zyklus`,
      },
    ];
  }
  return [];
}

export function checkTermOrder(lesson: Lesson, allLessons: Lesson[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const allowedLessonIds = transitivePrerequisites(lesson.id, allLessons);
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
    ...checkKeySentenceHasKeyRole(lesson),
    ...checkFaqBlocksMatchEntries(lesson),
    ...checkTermsListCoversTerms(lesson),
    ...checkTermsHaveImageOrExample(lesson),
    ...checkTermBlockFollowedByExample(lesson),
    ...checkSentenceLength(lesson),
    ...checkPrerequisitesExist(lesson, allLessons),
    ...checkPrerequisitesAreEarlier(lesson),
    ...checkNoPrerequisiteCycles(lesson, allLessons),
    ...checkTermOrder(lesson, allLessons),
    ...checkDistractorsSameArea(lesson, allLessons),
  ];
}
