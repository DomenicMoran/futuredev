import { z } from 'zod';

// Modulkennung: zwei Ziffern, M01 bis M10 (fest aus dem gemeinsamen Auftrag).
export const moduleIdSchema = z.string().regex(/^M\d{2}$/, 'Modulkennung muss dem Muster M00 folgen');

// Untermodulkennung: Modul plus zwei Ziffern, etwa M03-02.
export const subModuleIdSchema = z
  .string()
  .regex(/^M\d{2}-\d{2}$/, 'Untermodulkennung muss dem Muster M00-00 folgen');

const subModuleSchema = z.object({
  id: subModuleIdSchema,
  title: z.string().min(1),
});

const moduleSchema = z.object({
  id: moduleIdSchema,
  title: z.string().min(1),
  subModules: z.array(subModuleSchema).min(1),
});

export const modulesFileSchema = z.object({
  modules: z.array(moduleSchema).length(10, 'Modulkarte muss genau M01 bis M10 enthalten'),
});

export type ModulesFile = z.infer<typeof modulesFileSchema>;
export type ModuleEntry = z.infer<typeof moduleSchema>;
export type SubModuleEntry = z.infer<typeof subModuleSchema>;
