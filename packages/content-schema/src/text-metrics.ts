// Satz- und Wortzaehlung fuer Lektionstexte (AW-046, inhaltsformat.md Regel 14
// und faq-Regel 12). Reine Funktionen, keine Abhaengigkeiten, damit sie sowohl
// vom Zod-Schema (Refinements) als auch von rules.ts benutzt werden koennen.

// Bekannte Abkuerzungen ohne Leerzeichen vor dem Punkt ("bzw.", "usw." ...), die
// keinen Satzendepunkt bilden. Kleingeschrieben gefuehrt, Vergleich case-insensitiv.
const KNOWN_ABBREVIATIONS = new Set([
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
]);

/**
 * Zerlegt einen Text in Saetze an ".", "!", "?". Heuristik gegen Fehlalarme bei
 * buchstabierten Abkuerzungen ("CPU. C, P, U." oder "z. B."): ein Punkt zaehlt
 * nicht als Satzende, wenn das direkt davorstehende Wort aus genau einem
 * Buchstaben besteht (deckt jeden Buchstabieranfang wie "C.", "P.", "U.", "z."
 * ab, egal ob mit oder ohne Leerzeichen zum naechsten Buchstaben) oder eine der
 * bekannten mehrbuchstabigen Abkuerzungen ist ("bzw.", "usw." ...). Grenze
 * dieser Heuristik: eine echte Abkuerzung aus zwei oder mehr Buchstaben, die
 * nicht in der Liste steht, wird faelschlich als Satzende gezaehlt; das ist in
 * deutschen Lektionstexten mit kurzen, einfachen Saetzen (Regel 14) selten und
 * macht den erkannten Satz eher kuerzer, nie laenger, also nie faelschlich zu
 * einem Regelverstoss bei der Maximallaenge.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  const chars = Array.from(text);

  for (const ch of chars) {
    current += ch;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;

    if (ch === '.') {
      const match = /(\S+)\s*$/.exec(current.slice(0, -1));
      const lastWord = (match?.[1] ?? '').replace(/\.$/, '');
      const isSingleLetter = /^[A-Za-zÄÖÜäöü]$/.test(lastWord);
      const isKnownAbbreviation = KNOWN_ABBREVIATIONS.has(lastWord.toLowerCase());
      if (isSingleLetter || isKnownAbbreviation) continue;
    }

    const trimmed = current.trim();
    if (trimmed.length > 0) sentences.push(trimmed);
    current = '';
  }

  const rest = current.trim();
  if (rest.length > 0) sentences.push(rest);
  return sentences;
}

/** Wortzahl eines Satzes oder Texts, getrennt an Leerraum. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Anzahl vollstaendiger Saetze in einem Text (fuer die faq-answer-Regel). */
export function countSentences(text: string): number {
  return splitSentences(text).length;
}
