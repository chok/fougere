import { defineConfig } from 'vitest/config';

/**
 * Three of these files build a TypeScript program before they assert anything, and
 * vitest's default 5 s is a unit test's budget. Measured on the CI runner, where
 * `pnpm -r` runs four packages' workers at once: 4849 / 4911 / 5036 ms for the first
 * test of each scanning file, against 23 and 27 ms for the two that scan nothing.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
});
