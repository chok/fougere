import { defineConfig } from 'vitest/config';

/**
 * A boot here scans, so its first test builds a TypeScript program — 5013 ms on the CI runner
 * with a cold scan cache, against vitest's 5 s. The same budget `calls` and `cli` state.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
