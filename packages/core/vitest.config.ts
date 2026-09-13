import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * `#ambient` and `#crypto` resolve to `dist/` for a consumer, and there is no `dist/`
 * under test — the tests run the sources. They run the realization Node has.
 */
export default defineConfig({
  test: {
    // 42 of the 76 files here build a TypeScript program. One of them alone takes 2.8 s;
    // the whole suite sums 205 s of test time over 27 s of wall clock, so eight of those
    // scans contend for the machine at once and the 5 s default is a coin toss. The number
    // is what a scan costs under that contention, not a margin picked for comfort.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '#ambient': fileURLToPath(new URL('./src/boot/ambient.als.ts', import.meta.url)),
      '#crypto': fileURLToPath(new URL('./src/crypto/node.ts', import.meta.url)),
    },
  },
});
