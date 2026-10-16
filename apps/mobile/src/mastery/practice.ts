import type { Lesson } from '@futuredev/content-schema';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { getDatabase } from '../data/db.js';

export interface PracticeEvidence {
  fingerprint: string;
  explanation: string;
  spoken: boolean;
  checked: number[];
  completedAt: string | null;
}
export function practiceFingerprint(lesson: Lesson): string {
  return bytesToHex(
    sha256(
      utf8ToBytes(
        JSON.stringify({
          task: lesson.practiceTask,
          key: lesson.speechBlocks.find((b) => b.isKeySentence)?.text,
        }),
      ),
    ),
  );
}
export function emptyPractice(lesson: Lesson): PracticeEvidence {
  return {
    fingerprint: practiceFingerprint(lesson),
    explanation: '',
    spoken: false,
    checked: [],
    completedAt: null,
  };
}
export function canCompletePractice(value: PracticeEvidence, lesson: Lesson): boolean {
  return (
    value.fingerprint === practiceFingerprint(lesson) &&
    (value.spoken || value.explanation.trim().length >= 40) &&
    lesson.practiceTask.checklist.every((_, i) => value.checked.includes(i))
  );
}
export function validatePractice(raw: string): PracticeEvidence {
  let v: PracticeEvidence;
  try {
    v = JSON.parse(raw) as PracticeEvidence;
  } catch {
    throw new Error('Der Praxisentwurf ist beschädigt. Bitte eine Datensicherung importieren.');
  }
  if (
    !v ||
    typeof v.fingerprint !== 'string' ||
    typeof v.explanation !== 'string' ||
    v.explanation.length > 20000 ||
    typeof v.spoken !== 'boolean' ||
    !Array.isArray(v.checked) ||
    new Set(v.checked).size !== v.checked.length ||
    v.checked.some((i) => !Number.isInteger(i) || i < 0) ||
    (v.completedAt !== null &&
      (typeof v.completedAt !== 'string' || !Number.isFinite(Date.parse(v.completedAt))))
  )
    throw new Error('Der Praxisentwurf ist beschädigt. Bitte eine Datensicherung verwenden.');
  return v;
}
export function parsePractice(raw: string | undefined, lesson: Lesson): PracticeEvidence {
  if (!raw) return emptyPractice(lesson);
  const v = validatePractice(raw);
  // Keep the learner's writing after content updates, but never silently award new tasks.
  if (v.fingerprint !== practiceFingerprint(lesson))
    return { ...emptyPractice(lesson), explanation: v.explanation };
  if (
    v.checked.some((i) => i >= lesson.practiceTask.checklist.length) ||
    (v.completedAt !== null && !canCompletePractice(v, lesson))
  )
    throw new Error('Der Praxisnachweis ist unvollständig oder beschädigt.');
  return v;
}
export async function loadPractice(lesson: Lesson): Promise<PracticeEvidence> {
  return parsePractice(await (await getDatabase()).getSetting('practice_v1.' + lesson.id), lesson);
}
export async function savePractice(lesson: Lesson, value: PracticeEvidence): Promise<void> {
  if (value.fingerprint !== practiceFingerprint(lesson))
    throw new Error('Die Aufgabe wurde geändert. Bitte neu laden.');
  parsePractice(JSON.stringify(value), lesson);
  if (value.completedAt && !canCompletePractice(value, lesson))
    throw new Error('Bitte Erklärung und alle Prüfpunkte zuerst bearbeiten.');
  await (await getDatabase()).setSetting('practice_v1.' + lesson.id, JSON.stringify(value));
}
