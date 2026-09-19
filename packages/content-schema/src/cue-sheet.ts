import { z } from 'zod';
import { cueSectionSchema, lessonIdSchema } from './lesson.js';

// Kapitelmarken-Sidecar zu einer vertonten Lektion: startSeconds/durationSeconds
// je Sprechblock, berechnet aus den gemessenen Blockdauern plus den Pausen
// zwischen den Bloecken (siehe tools/audio/src/cues.ts). Getrennt von der MP3
// abgelegt (<id>.cues.json), weil Blockgrenzen im Audio selbst nicht markiert
// sind (kein ID3-Kapitel-Frame in dieser Pipeline).
export const cueBlockSchema = z.object({
  index: z.number().int().nonnegative(),
  speaker: z.enum(['A', 'B']),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  isKeySentence: z.boolean(),
  // Siehe cueSectionSchema in lesson.ts (AW-045): fehlt das Feld, ist der
  // Block Teil des Hauptabschnitts ("body").
  section: cueSectionSchema.optional(),
});

export const cueSheetSchema = z.object({
  lessonId: lessonIdSchema,
  blocks: z.array(cueBlockSchema).min(1),
});

export type CueSheet = z.infer<typeof cueSheetSchema>;
export type CueBlock = z.infer<typeof cueBlockSchema>;
