import { defineConfig } from 'vitest/config';

/**
 * A test here scans, so the first one in a file builds a TypeScript program — over vitest's 5 s
 * on the CI runner with a cold scan cache. The same budget `defaults`, `calls` and `cli` state.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
});
