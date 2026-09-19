import { z } from 'zod';
import { portfolioItemSchema } from './lesson.js';

// Portfolio-Bausteine P00 bis P07 aus lehrplan-konzept.md, Abschnitt 8.
// Reihe echter, veröffentlichter Projekte mit steigendem Anspruch, die
// zusammen mit den Modulprüfungen und der Karriere-Checkliste die
// Jobreife-Anzeige speisen (@futuredev/core, readiness.ts).
const portfolioEntrySchema = z.object({
  id: portfolioItemSchema,
  title: z.string().min(1),
  goal: z.string().min(1),
  proof: z.string().min(1),
  prerequisites: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export const portfolioFileSchema = z.object({
  items: z.array(portfolioEntrySchema).length(8, 'Portfolio-Baustein-Liste muss genau P00 bis P07 enthalten'),
});

export type PortfolioFile = z.infer<typeof portfolioFileSchema>;
export type PortfolioEntry = z.infer<typeof portfolioEntrySchema>;
