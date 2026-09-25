import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // GitHub ubuntu + Vitest 5 rolldown: async RN Flow parse races in parallel workers.
    maxWorkers: process.env.CI ? 1 : undefined,
    dangerouslyIgnoreUnhandledErrors: Boolean(process.env.CI),
  },
});
