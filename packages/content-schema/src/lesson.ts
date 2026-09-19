import { z } from 'zod';
import { REPO_NOTE_NAMES } from './repo-notes.js';
import { countSentences } from './text-metrics.js';

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

// Rolle eines Sprechblocks (AP-4.1, inhaltsformat.md): sagt, welche Funktion
// der Block im Fuenf-Schritt-Muster (AW-046) oder im Rahmen der Lektion
// erfuellt. "image" = Alltagsbild, "explain" = Erklaerung in einfachen Worten,
// "term" = Fachausdruck wird benannt/definiert, "example" = zweites Beispiel
// aus Praxis oder Repo, "why" = Satz, warum es wichtig ist, "question" = Frage
// von Sprecher B, "key" = der eine Kernsatz der Lektion (isKeySentence),
// "terms_list" = Begriffsliste am Lektionsende, "faq" = vertonte
// Frage/Antwort-Bloecke aus dem Feld faq. Ersetzt das frueher optionale
// section-Feld als Wahrheitsquelle beim Schreiben; section bleibt nur noch als
// abgeleitetes Feld im Cue-Sidecar (tools/audio/src/cues.ts leitet section aus
// role ab, siehe dort).
export const blockRoleSchema = z.enum([
  'image',
  'explain',
  'term',
  'example',
  'why',
  'question',
  'key',
  'terms_list',
  'faq',
]);
export type BlockRole = z.infer<typeof blockRoleSchema>;

const speechBlockSchema = z.object({
  speaker: z.enum(['A', 'B']),
  text: z.string().min(1),
  isKeySentence: z.boolean(),
  role: blockRoleSchema,
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

// Pflichtfeld seit AP-4.1 (AW-045): "Fragen, die jetzt offen sein koennten".
// answer braucht laut inhaltsformat.md Regel 12 mindestens zwei vollstaendige
// Saetze; countSentences() nutzt dieselbe Satzende-Heuristik wie Regel 14
// (siehe text-metrics.ts), damit buchstabierte Abkuerzungen keine falschen
// Satzenden erzeugen.
const faqEntrySchema = z.object({
  question: z.string().min(1).regex(/\?$/, 'Frage muss mit einem Fragezeichen enden'),
  answer: z
    .string()
    .min(1)
    .refine((value) => countSentences(value) >= 2, 'Antwort muss mindestens zwei vollständige Sätze haben'),
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
  // Pflichtfeld seit AP-4.1 (AW-045): mindestens fuenf Eintraege. Konsistenz
  // zu den vertonten faq-Sprechbloecken prueft rules.ts (checkFaqBlocksMatchEntries).
  faq: z.array(faqEntrySchema).min(5, 'mindestens fünf FAQ-Einträge'),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type SpeechBlock = z.infer<typeof speechBlockSchema>;
export type FaqEntry = z.infer<typeof faqEntrySchema>;
