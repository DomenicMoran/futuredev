import { z } from 'zod';

// Karriere-Checkliste aus lehrplan-konzept.md, Abschnitt 9 (M10): Punkte, die
// zusammen mit den Modulprüfungen und dem Portfolio die Jobreife-Anzeige
// speisen. `id` ist der Primärschlüssel der Tabelle `career_checklist`
// (datenmodell.md, Spalte `item`).
const careerItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const careerFileSchema = z.object({
  items: z.array(careerItemSchema).min(1),
});

export type CareerFile = z.infer<typeof careerFileSchema>;
export type CareerItem = z.infer<typeof careerItemSchema>;
