import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keep CI serial while native-heavy suites are costlier under parallel
    // workers; errors and unhandled rejections remain fatal everywhere.
    maxWorkers: process.env.CI ? 1 : undefined,
  },
});
