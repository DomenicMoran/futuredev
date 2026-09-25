import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Rolldown + react-native Flow on Linux CI: parallel workers race on RN imports.
    maxWorkers: process.env.CI ? 1 : undefined,
  },
});
