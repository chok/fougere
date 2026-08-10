import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

/**
 * `ssr.external` is the whole integration cost, and it is the same statement
 * `demos/next-blog` makes as `serverExternalPackages`.
 *
 * The scan reads a frond's TypeScript sources off disk through jiti at boot, so
 * these must stay out of the server bundle and be imported at runtime. Every host
 * has a supported option for this — no plugin, no aliasing, no indirection to
 * defeat a bundler.
 */
export default defineConfig({
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
  plugins: [tanstackStart(), viteReact()],
});
