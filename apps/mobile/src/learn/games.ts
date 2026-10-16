// Drei Übungen aus vorhandenen Begriffen. Der Zug ist die Fachhandlung:
// zuordnen, den Fremdkörper finden, die Reihenfolge der Lektion legen.

export interface TermCard {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
  readonly lessonId: string;
}

export interface MatchRound {
  readonly prompt: string;
  readonly answerId: string;
  readonly choices: readonly { id: string; label: string }[];
}

export interface OddRound {
  readonly prompt: string;
  readonly choices: readonly { id: string; label: string; outsider: boolean }[];
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0 || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

export function buildMatchRound(terms: readonly TermCard[], seed: number): MatchRound | null {
  const usable = terms.filter((term) => term.term.trim() && term.definition.trim());
  if (usable.length < 2) return null;
  const ordered = shuffle(usable, seed);
  const answer = ordered[0];
  if (!answer) return null;
  const choices = shuffle(ordered.slice(0, Math.min(4, ordered.length)), seed + 1).map((term) => ({
    id: term.id,
    label: term.term,
  }));
  return { prompt: answer.definition, answerId: answer.id, choices };
}

function lessonGroups(terms: readonly TermCard[]): TermCard[][] {
  const byLesson = new Map<string, TermCard[]>();
  for (const term of terms) {
    const group = byLesson.get(term.lessonId) ?? [];
    group.push(term);
    byLesson.set(term.lessonId, group);
  }
  return [...byLesson.values()];
}

export function buildOddRound(terms: readonly TermCard[], seed: number): OddRound | null {
  const hosts = lessonGroups(terms).filter((group) => group.length >= 3);
  if (hosts.length === 0) return null;
  const host = hosts[(seed >>> 0) % hosts.length];
  if (!host) return null;
  const outsiders = terms.filter((term) => term.lessonId !== host[0]?.lessonId);
  const outsider = shuffle(outsiders, seed + 2)[0];
  if (!outsider) return null;
  const choices = shuffle(
    [
      ...host.slice(0, 3).map((term) => ({ id: term.id, label: term.term, outsider: false })),
      { id: outsider.id, label: outsider.term, outsider: true },
    ],
    seed,
  );
  return { prompt: 'Welcher Begriff gehört nicht zu den anderen?', choices };
}

export function buildSequence(terms: readonly TermCard[], seed: number): { expected: string[]; shuffled: TermCard[] } | null {
  const groups = lessonGroups(terms).filter((group) => group.length >= 3);
  if (groups.length === 0) return null;
  const sameLesson = groups[(seed >>> 0) % groups.length];
  if (!sameLesson) return null;
  const slice = sameLesson.slice(0, 4);
  return { expected: slice.map((term) => term.id), shuffled: shuffle(slice, seed) };
}

export function sequenceIsCorrect(submitted: readonly string[], expected: readonly string[]): boolean {
  return submitted.length === expected.length && submitted.every((id, index) => id === expected[index]);
}

export interface SpotSentence {
  readonly words: readonly string[];
  readonly wrongIndex: number;
}

/** Ein Satz aus dem Stoff, in dem genau ein Wort durch einen Fremdkörper ersetzt ist. */
export function buildSpot(sentence: string, intruder: string): SpotSentence | null {
  const words = sentence.trim().split(/\s+/).filter((word) => word.length > 0);
  const replacement = intruder.trim();
  if (words.length < 4 || replacement.length < 3) return null;
  const index = words.findIndex((word) => word.replace(/[.,]/g, '').length > 4);
  if (index < 0) return null;
  const next = [...words];
  next[index] = replacement;
  return { words: next, wrongIndex: index };
}

export const PACKET_STEPS = [
  { id: 'client', label: 'Das Handy schickt die Anfrage' },
  { id: 'dns', label: 'DNS nennt die Adresse des Servers' },
  { id: 'server', label: 'Der Server liest die Anfrage' },
  { id: 'answer', label: 'Die Antwort kommt zum Handy zurück' },
] as const;

export function buildPacket(seed: number): { expected: string[]; shuffled: { id: string; label: string }[] } {
  return {
    expected: PACKET_STEPS.map((step) => step.id),
    shuffled: shuffle(PACKET_STEPS, seed).map((step) => ({ id: step.id, label: step.label })),
  };
}

export interface ColumnFact {
  readonly id: string;
  readonly side: 'tcp' | 'udp';
  readonly label: string;
}

export const TCP_UDP: readonly ColumnFact[] = [
  { id: 'ack', side: 'tcp', label: 'Bestätigt, dass ein Paket ankam' },
  { id: 'order', side: 'tcp', label: 'Hält die Reihenfolge der Pakete' },
  { id: 'fast', side: 'udp', label: 'Schickt los, ohne auf eine Bestätigung zu warten' },
  { id: 'drop', side: 'udp', label: 'Ein verlorenes Paket wird nicht nachgeliefert' },
];

export function columnsAreCorrect(placed: Readonly<Record<string, 'tcp' | 'udp' | undefined>>): boolean {
  return TCP_UDP.every((fact) => placed[fact.id] === fact.side);
}

function overlap(left: string, right: string): boolean {
  const words = new Set(
    right.toLocaleLowerCase('de').split(/\s+/).filter((word) => word.length > 4),
  );
  return left.toLocaleLowerCase('de').split(/\s+/).some((word) => word.length > 4 && words.has(word));
}

/** Nur Paare, die sich ein tragendes Wort teilen. Sonst übt Zuordnen bloß Tippen. */
export function buildConfusableMatch(terms: readonly TermCard[], seed: number): MatchRound | null {
  const usable = terms.filter((term) => term.term.trim() && term.definition.trim());
  const host = shuffle(usable, seed).find((term) => usable.some((other) => other.id !== term.id && overlap(term.definition, other.definition)));
  if (!host) return null;
  const neighbors = usable.filter((term) => term.id === host.id || overlap(host.definition, term.definition));
  return buildMatchRound(neighbors.length >= 2 ? neighbors : usable, seed + 1);
}

export function exampleClause(definition: string): string | null {
  const match = /zum Beispiel\s+([^.]+\.?)/i.exec(definition);
  const clause = match?.[1]?.trim();
  if (!clause || clause.length < 8) return null;
  return clause.replace(/\.$/, '');
}
