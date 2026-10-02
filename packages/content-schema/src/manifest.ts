import { z } from 'zod';
import { lessonIdSchema } from './lesson.js';

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Version muss semver sein, etwa 0.1.0');

const manifestLessonSchema = z.object({
  id: lessonIdSchema,
  file: z.string().regex(/^[A-Za-z0-9-]+\.json$/, 'Dateiname muss ein sicherer lokaler JSON-Dateiname sein'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'sha256 muss 64 Hex-Zeichen sein'),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const manifestSchema = z.object({
  version: semverSchema,
  contentBaseUrl: z.url().refine((value) => { const url = new URL(value); return url.protocol === 'https:' && !url.search && !url.hash; }, 'contentBaseUrl must be HTTPS without query or fragment'),
  audioBaseUrl: z.url().refine((value) => { const url = new URL(value); return url.protocol === 'https:' && !url.search && !url.hash; }, 'audioBaseUrl must be HTTPS without query or fragment'),
  /** Absent only on pre-0.6 legacy manifests; new package generations require it to activate. */
  modulesSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  lessons: z.array(manifestLessonSchema),
}).superRefine((manifest, context) => {
  const seen = new Set<string>();
  manifest.lessons.forEach((lesson, index) => {
    if (lesson.file !== `${lesson.id}.json`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lessons', index, 'file'], message: 'Dateiname muss zur Lektionskennung passen' });
    if (seen.has(lesson.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lessons', index, 'id'], message: 'Lektionskennung darf nicht doppelt vorkommen' });
    seen.add(lesson.id);
  });
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestLesson = z.infer<typeof manifestLessonSchema>;
