import { defineConfig } from 'vitest/config';

/**
 * Seven of these thirteen files build a TypeScript program before they assert anything,
 * and vitest's default 5 s is a unit test's budget. The program is paid ONCE per worker:
 * the first test of `explain.test.ts` took 5221 ms on the CI runner against 455 ms here,
 * and the three that follow it in the same file took 10, 8 and 7 ms.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
});
