import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * `#trace-context` resolves to `dist/` for a consumer, and there is no `dist/` under
 * test — the tests run the sources. They run the realization Node has.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#trace-context': fileURLToPath(new URL('./src/context/als.ts', import.meta.url)),
    },
  },
});
