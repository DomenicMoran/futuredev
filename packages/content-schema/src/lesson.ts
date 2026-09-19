import { z } from 'zod';
import { REPO_NOTE_NAMES } from './repo-notes.js';

// Lektionskennung: Modul, Untermodul, Lektion, je zwei Ziffern.
// Beispiel: M03-02-04.
export const lessonIdSchema = z
  .string()
  .regex(/^M\d{2}-\d{2}-\d{2}$/, 'Lektionskennung muss dem Muster M00-00-00 folgen');

export const portfolioItemSchema = z
  .string()
  .regex(/^P0[0-7]$/, 'Portfolio-Baustein muss P00 bis P07 sein');

const termSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

// Abschnitt eines Sprechblocks innerhalb der Lektion, fuer Kapitelmarken bei
// laengeren Lektionen (20 bis 40 Minuten, AW-045). Optional, weil die
// bestehenden Lektionen (etwa M01-01-01) noch keine Abschnittsgrenzen
// vertonen: fehlt das Feld, gilt ein Block als "body".
export const cueSectionSchema = z.enum(['body', 'terms', 'example', 'task', 'faq']);
export type CueSection = z.infer<typeof cueSectionSchema>;

const speechBlockSchema = z.object({
  speaker: z.enum(['A', 'B']),
  text: z.string().min(1),
  isKeySentence: z.boolean(),
  section: cueSectionSchema.optional(),
});

const practiceExampleSchema = z.object({
  text: z.string().min(1),
  repoNote: z.enum(REPO_NOTE_NAMES),
  location: z.string().min(1),
});

const quizOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
  explanation: z.string().min(1),
});

const quizQuestionSchema = z.object({
  question: z.string().min(1),
  // Ablenker-Bereich (Untermodul) fuer die Ablenker-aus-demselben-Bereich-Regel.
  area: z.string().min(1),
  options: z.array(quizOptionSchema).length(4, 'genau vier Optionen je Frage'),
});

const practiceTaskSchema = z.object({
  task: z.string().min(1),
  expectation: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
  portfolioItem: portfolioItemSchema.optional(),
});

// Pflichtfeld ab Phase 4 (AW-045): "Fragen, die jetzt offen sein koennten".
// Bis das Schema es verlangt (erste Inhaltswelle), bleibt das Feld optional,
// damit bestehende Lektionen ohne faq weiter gueltig sind.
const faqEntrySchema = z.object({
  question: z.string().min(1).regex(/\?$/, 'Frage muss mit einem Fragezeichen enden'),
  answer: z.string().min(1),
});

const audioSchema = z.object({
  file: z.string().regex(/^M\d{2}-\d{2}-\d{2}\.mp3$/, 'Audiodatei muss <Lektionskennung>.mp3 heißen'),
  durationSeconds: z.number().int().positive(),
  voices: z.array(z.enum(['A', 'B'])).min(1),
  // Pflichtfeld nach EU AI Act Art. 50: Kennzeichnung als KI-Stimme. Immer true,
  // als Literal geschrieben, damit ein Vergessen im Schema auffällt statt in der App.
  aiGenerated: z.literal(true),
});

export const lessonSchema = z.object({
  id: lessonIdSchema,
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  prerequisites: z.array(lessonIdSchema),
  terms: z.array(termSchema),
  speechBlocks: z.array(speechBlockSchema).min(1),
  practiceExample: practiceExampleSchema,
  quiz: z.array(quizQuestionSchema).min(10, 'mindestens zehn Fragen je Lektion'),
  practiceTask: practiceTaskSchema,
  audio: audioSchema,
  // Optional bis Phase 4 (AW-045); danach mindestens 5 Eintraege, siehe
  // packages/content-schema/src/rules.ts (checkFaqMinimumWhenPresent gilt nur,
  // wenn eine spaetere Pflicht-Version das Feld einfuehrt).
  faq: z.array(faqEntrySchema).min(5).optional(),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type SpeechBlock = z.infer<typeof speechBlockSchema>;
export type FaqEntry = z.infer<typeof faqEntrySchema>;
