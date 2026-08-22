import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * `#ambient` resolves to `dist/` for a consumer, and there is no `dist/` under test —
 * the tests run the sources. They run the realization Node has.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#ambient': fileURLToPath(new URL('./src/boot/ambient.als.ts', import.meta.url)),
    },
  },
});
