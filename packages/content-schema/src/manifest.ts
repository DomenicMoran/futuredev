import { z } from 'zod';
import { lessonIdSchema } from './lesson.js';

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Version muss semver sein, etwa 0.1.0');

const manifestLessonSchema = z.object({
  id: lessonIdSchema,
  file: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'sha256 muss 64 Hex-Zeichen sein'),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const manifestSchema = z.object({
  version: semverSchema,
  contentBaseUrl: z.url(),
  audioBaseUrl: z.url(),
  lessons: z.array(manifestLessonSchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestLesson = z.infer<typeof manifestLessonSchema>;
