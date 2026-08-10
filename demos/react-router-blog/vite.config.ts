import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

/**
 * `ssr.external` is the whole integration cost — the same statement `next.config.ts`
 * makes as `serverExternalPackages` and `vite.config.ts` makes in the TanStack demo.
 * The scan reads frond sources off disk through jiti at boot, so they must not be
 * bundled.
 */
export default defineConfig({
  plugins: [reactRouter()],
  resolve: { tsconfigPaths: true },
  ssr: {
    external: [
      '@fougere/app',
      '@fougere/core',
      '@fougere/schema',
      '@fougere/schema-sql',
      'better-sqlite3',
      'jiti',
      'typescript',
    ],
  },
});
