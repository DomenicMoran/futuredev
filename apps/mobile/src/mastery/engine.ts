import { drawQuestions, type QuizQuestionInput } from '@futuredev/core';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export type Medium = 'audio' | 'read' | 'mixed';
export interface BankQuestion extends QuizQuestionInput {
  key: string;
}
export type ExamScope = 'remaining' | 'all' | 'review' | { lessonIds: string[]; title: string };
export interface Session {
  title?: string;
  keys: string[];
  orders: number[][];
  answers: number[];
  startedAt: string;
}
export interface MasteryState {
  version: 1;
  medium: Medium;
  examMode?: 'modules' | 'whole';
  selectedModule?: string;
  results: Record<string, boolean>;
  reviewed: string[];
  session: Session | null;
  history: {
    at: string;
    correct: number;
    total: number;
    remaining: number;
    affectedLessons?: string[];
  }[];
}
export const emptyState = (): MasteryState => ({
  version: 1,
  medium: 'audio',
  results: {},
  reviewed: [],
  session: null,
  history: [],
});
export function makeBank(pool: QuizQuestionInput[]): BankQuestion[] {
  const identities = new Set<string>();
  return pool.map((q) => {
    const identity = `${q.sourceLessonId}/${q.questionId}`;
    if (
      !q.questionId ||
      !q.sourceLessonId ||
      identities.has(identity) ||
      q.options.filter((o) => o.isCorrect).length !== 1
    )
      throw new Error('Ungültiger Fragenbestand');
    identities.add(identity);
    return { ...q, key: identity + ':' + bytesToHex(sha256(utf8ToBytes(JSON.stringify(q)))) };
  });
}
export function summary(state: MasteryState, bank: BankQuestion[]) {
  const passed = bank.filter((q) => state.results[q.key] === true).length;
  const wrong = bank.filter((q) => state.results[q.key] === false);
  const unseen = bank.filter((q) => state.results[q.key] === undefined).length;
  return {
    passed,
    wrong,
    unseen,
    remaining: bank.length - passed,
    percent: bank.length ? Math.floor((passed * 100) / bank.length) : 0,
  };
}
export function begin(
  state: MasteryState,
  bank: BankQuestion[],
  full: boolean | ExamScope = false,
  seed = Date.now(),
): MasteryState {
  if (state.session) throw new Error('Bitte die laufende Prüfung zuerst fortsetzen.');
  const scope = full === true ? 'all' : full === false ? 'remaining' : full;
  const ids = typeof scope === 'object' ? new Set(scope.lessonIds) : null;
  const pending = bank.filter((q) =>
    ids
      ? ids.has(q.sourceLessonId)
      : scope === 'all' ||
        (scope === 'review' ? state.results[q.key] === false : state.results[q.key] !== true),
  );
  if (!pending.length) throw new Error('Keine offenen Fragen.');
  const byIdentity = new Map(pending.map((q) => [`${q.sourceLessonId}/${q.questionId}`, q.key]));
  const drawn = drawQuestions(pending, pending.length, seed);
  return {
    ...state,
    session: {
      title:
        typeof scope === 'object'
          ? scope.title
          : scope === 'review'
            ? 'Gemeinsame Wiederholungsprüfung'
            : scope === 'all'
              ? 'Gesamtprüfung'
              : 'Alle offenen Fragen',
      keys: drawn.map((q) => byIdentity.get(`${q.sourceLessonId}/${q.questionId}`) ?? ''),
      orders: drawn.map((q) => q.options.map((o) => o.index)),
      answers: [],
      startedAt: new Date().toISOString(),
    },
  };
}
export function answer(state: MasteryState, choice: number, bank: BankQuestion[]): MasteryState {
  const session = state.session;
  if (!session) throw new Error('Keine laufende Prüfung.');
  const key = session.keys[session.answers.length];
  const q = bank.find((q) => q.key === key);
  if (!q || !Number.isInteger(choice) || choice < -1 || choice >= q.options.length)
    throw new Error('Frage oder Antwort nicht verfügbar.');
  return { ...state, session: { ...session, answers: [...session.answers, choice] } };
}
/** Only submitted answers count. Unanswered/new/changed content never becomes mastered. */
export function finish(state: MasteryState, bank: BankQuestion[]): MasteryState {
  const session = state.session;
  if (!session?.answers.length) throw new Error('Bitte zuerst eine Frage beantworten.');
  const byKey = new Map(bank.map((q) => [q.key, q]));
  const results = { ...state.results };
  const affected = new Set<string>();
  let correct = 0;
  let total = 0;
  session.answers.forEach((choice, i) => {
    const q = byKey.get(session.keys[i] ?? '');
    if (!q) return; // Changed content is untested, never graded using obsolete answers.
    affected.add(q.sourceLessonId);
    const passed = choice !== -1 && q.options[choice]?.isCorrect === true;
    results[q.key] = passed;
    total += 1;
    if (passed) correct += 1;
  });
  const next = {
    ...state,
    results,
    session: null,
    reviewed: state.reviewed.filter((id) => !affected.has(id)),
  };
  return {
    ...next,
    history: [
      ...state.history,
      {
        at: new Date(
          Math.max(Date.now(), Date.parse(state.history.at(-1)?.at ?? '') + 1 || 0),
        ).toISOString(),
        correct,
        total,
        remaining: summary(next, bank).remaining,
        affectedLessons: [...affected],
      },
    ].slice(-100),
  };
}
export function parseState(raw: string | undefined): MasteryState {
  if (raw === undefined) return emptyState();
  const s = JSON.parse(raw) as MasteryState;
  if (
    !s ||
    s.version !== 1 ||
    (s.examMode !== undefined && !['modules', 'whole'].includes(s.examMode)) ||
    (s.selectedModule !== undefined && typeof s.selectedModule !== 'string') ||
    !['audio', 'read', 'mixed'].includes(s.medium) ||
    !s.results ||
    Array.isArray(s.results) ||
    typeof s.results !== 'object' ||
    Object.values(s.results).some((v) => typeof v !== 'boolean') ||
    !Array.isArray(s.reviewed) ||
    s.reviewed.some((v) => typeof v !== 'string') ||
    !Array.isArray(s.history) ||
    s.history.some(
      (h) =>
        !h ||
        (h.affectedLessons !== undefined &&
          (!Array.isArray(h.affectedLessons) ||
            h.affectedLessons.some((id) => typeof id !== 'string'))) ||
        typeof h.at !== 'string' ||
        !Number.isFinite(Date.parse(h.at)) ||
        !Number.isInteger(h.total) ||
        !Number.isInteger(h.correct) ||
        h.correct < 0 ||
        h.correct > h.total ||
        !Number.isInteger(h.remaining) ||
        h.remaining < 0,
    )
  )
    throw new Error(
      'Der gespeicherte Lernkreislauf ist beschädigt. Bitte eine Datensicherung verwenden.',
    );
  if (s.session !== null) {
    const r = s.session;
    if (
      !r ||
      (r.title !== undefined && typeof r.title !== 'string') ||
      !Array.isArray(r.keys) ||
      !r.keys.length ||
      r.keys.some((k) => typeof k !== 'string') ||
      new Set(r.keys).size !== r.keys.length ||
      !Array.isArray(r.orders) ||
      r.orders.length !== r.keys.length ||
      r.orders.some(
        (o) =>
          !Array.isArray(o) ||
          o.length < 2 ||
          new Set(o).size !== o.length ||
          o.some((n) => !Number.isInteger(n) || n < 0 || n >= o.length),
      ) ||
      !Array.isArray(r.answers) ||
      r.answers.length > r.keys.length ||
      r.answers.some((n, i) => !Number.isInteger(n) || n < -1 || n >= (r.orders[i]?.length ?? 0)) ||
      typeof r.startedAt !== 'string'
    )
      throw new Error('Die gespeicherte Prüfung ist beschädigt.');
  }
  return s;
}
