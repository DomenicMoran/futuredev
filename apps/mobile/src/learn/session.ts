// Reine Sitzungslogik: welche Übung als Nächstes kommt, ob eine freie Antwort
// den Begriff trifft, und wie ein Fehlversuch benannt wird. Kein Punktekonto.

export type Energy = 'ruhig' | 'wach';

export type Door = 'bild' | 'beispiel' | 'begriff';

export type Focus = 'begriff' | 'ablauf' | 'fehler';

export type ErrorKind = 'verwechselt' | 'vergessen' | 'reihenfolge' | 'randfall';

export type Drill = 'contrast' | 'sequence' | 'spot' | 'example';

export type SessionStep =
  | { type: 'recall' }
  | { type: 'options' }
  | { type: 'key-sentences' }
  | { type: 'one-card' }
  | { type: 'pause' }
  | { type: 'practice'; drill: Drill }
  | { type: 'second-example' }
  | { type: 'stop' };

const STOP_WORDS = new Set([
  'eine', 'einer', 'einem', 'einen', 'der', 'die', 'das', 'und', 'oder', 'mit',
  'von', 'für', 'auf', 'ist', 'sind', 'wird', 'ein', 'nicht', 'auch', 'sich',
  'dass', 'wie', 'bei', 'aus', 'nach', 'zum', 'zur', 'den', 'dem', 'des',
]);

export function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
}

function significantWords(text: string): string[] {
  return normalizeAnswer(text)
    .split(' ')
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

export function drillFor(kind: ErrorKind): Drill {
  if (kind === 'reihenfolge') return 'sequence';
  if (kind === 'randfall') return 'spot';
  if (kind === 'verwechselt') return 'contrast';
  return 'example';
}

export function nextStep(input: {
  energy: Energy;
  unsureStreak: number;
  itemsDone: number;
  hasConfusion: boolean;
  recallHit?: boolean;
  sawOptions?: boolean;
  sawPractice?: boolean;
  sawExample?: boolean;
  keysDone?: boolean;
  errorKind?: ErrorKind | null;
  focus?: Focus;
}): SessionStep {
  const recallHit = input.recallHit === true;
  const sawOptions = input.sawOptions === true;
  const sawPractice = input.sawPractice === true;
  const sawExample = input.sawExample === true;
  const keysDone = input.keysDone === true;
  if (input.unsureStreak >= 2) return { type: 'pause' };
  if (input.focus === 'ablauf' && !sawPractice) return { type: 'practice', drill: 'sequence' };
  if (input.focus === 'fehler' && !sawPractice) return { type: 'practice', drill: 'spot' };
  if (input.focus && input.focus !== 'begriff' && sawPractice) return { type: 'stop' };
  if (input.energy === 'ruhig' && !keysDone) return { type: 'key-sentences' };
  if (input.energy === 'ruhig' && !sawOptions) return { type: 'options' };
  if (input.energy === 'wach' && input.itemsDone === 0) {
    return input.hasConfusion ? { type: 'one-card' } : { type: 'recall' };
  }
  if (input.energy === 'wach' && !recallHit && !sawOptions) return { type: 'options' };
  if (input.energy === 'wach' && !recallHit && !sawPractice) {
    return { type: 'practice', drill: drillFor(input.errorKind ?? 'vergessen') };
  }
  if (!sawExample) return { type: 'second-example' };
  return { type: 'stop' };
}

const DOOR_ROLE: Record<Door, string> = { bild: 'image', beispiel: 'example', begriff: 'term' };

/** Dieselbe Lektion, andere Tür: Bild, Beispiel oder Begriff zuerst. */
export function openingBlocks(
  blocks: readonly { text: string; role?: string }[],
  door: Door,
): string[] {
  const role = DOOR_ROLE[door];
  const picked = blocks.map((block) => block.text.trim()).filter((text, index) => text.length > 0 && blocks[index]?.role === role);
  if (picked.length > 0) return picked.slice(0, 2);
  return blocks.map((block) => block.text.trim()).filter((text) => text.length > 0).slice(0, 2);
}

export function quietClose(input: { held: boolean; tomorrow: string | null }): string {
  const held = input.held ? 'Das sitzt.' : 'Das war noch unsicher.';
  const tomorrow = input.tomorrow ? `Morgen nur: ${input.tomorrow}.` : 'Morgen ist nichts extra vorgemerkt.';
  return `${held} ${tomorrow}`;
}

export function clozeOwnSentence(sentence: string): { prompt: string; missing: string } | null {
  const words = sentence.trim().split(/\s+/).filter((word) => word.length > 0);
  const index = words.findIndex((word) => word.replace(/[.,]/g, '').length > 5);
  if (index < 0 || words.length < 3) return null;
  const missing = words[index]?.replace(/[.,]/g, '') ?? '';
  if (!missing) return null;
  const prompt = words.map((word, wordIndex) => (wordIndex === index ? '____' : word)).join(' ');
  return { prompt, missing };
}

export function interleaveModules<T extends { lessonId: string }>(fresh: readonly T[], older: readonly T[], limit = 3): T[] {
  const home = fresh[0]?.lessonId.slice(0, 3) ?? '';
  const foreign = older.filter((card) => card.lessonId.slice(0, 3) !== home).slice(0, limit);
  if (!fresh[0] || foreign.length === 0) return [...fresh];
  return [fresh[0], ...foreign, ...fresh.slice(1)];
}

/** Text, der so nicht im Hörtext steht. Steht er dort, gibt es kein zweites Beispiel. */
export function textOutsideSpeech(candidate: string, speech: readonly string[]): string | null {
  const text = candidate.trim();
  if (text.length < 8) return null;
  const spoken = normalizeAnswer(speech.join('\n'));
  if (spoken.includes(normalizeAnswer(text))) return null;
  return text;
}

/** Eine freie Antwort trifft den Begriff, wenn sie ihn nennt oder seine tragenden Wörter enthält. */
export function recallCovers(answer: string, term: string, definition: string): boolean {
  const spoken = normalizeAnswer(answer);
  if (spoken.length < 2) return false;
  const named = normalizeAnswer(term);
  if (spoken === named || spoken.includes(named)) return true;
  const needed = significantWords(`${term} ${definition}`);
  if (needed.length === 0) return false;
  const heard = new Set(significantWords(spoken));
  const hits = needed.filter((word) => heard.has(word)).length;
  return hits >= Math.min(2, needed.length);
}

export function classifyMiss(input: {
  question: string;
  chosen: string;
  correct: string;
  answerBlank: boolean;
}): ErrorKind {
  if (input.answerBlank) return 'vergessen';
  if (/reihenfolge|zuerst|danach|bevor/i.test(input.question)) return 'reihenfolge';
  const chosen = new Set(significantWords(input.chosen));
  if (significantWords(input.correct).some((word) => chosen.has(word))) return 'verwechselt';
  return 'randfall';
}

export function firstHint(text: string): string {
  const trimmed = text.trim();
  const sentence = trimmed.match(/^[^.!?]+[.!?]/);
  return sentence?.[0]?.trim() || trimmed;
}

export function keySentences(blocks: readonly { text: string; isKeySentence?: boolean }[]): string[] {
  const marked = blocks.map((block) => block.text.trim()).filter((text, index) => text.length > 0 && blocks[index]?.isKeySentence);
  if (marked.length > 0) return marked;
  return blocks.map((block) => block.text.trim()).filter((text) => text.length > 40).slice(0, 2);
}

export function oneConfusionFirst<T extends { id: string }>(cards: readonly T[], confusionId: string | null): T[] {
  if (!confusionId) return [...cards];
  const hit = cards.find((card) => card.id === confusionId);
  if (!hit) return [...cards];
  return [hit, ...cards.filter((card) => card.id !== confusionId)];
}

/** Morgen liegt nur die gemerkte Verwechslung vorn, nicht der ganze Stapel. */
export function onlyStoredConfusion<T extends { id: string }>(cards: readonly T[], confusionId: string | null): T[] {
  if (!confusionId) return [...cards];
  const hit = cards.find((card) => card.id === confusionId);
  return hit ? [hit] : [...cards];
}

/** Nach dem ersten Versuch darf die Sitzung enden, ohne dass etwas zurückgesetzt wird. */
export function mayStop(itemsDone: number): boolean {
  return itemsDone >= 1;
}
