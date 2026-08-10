import type { NextConfig } from 'next';

/**
 * `serverExternalPackages` is the whole integration cost.
 *
 * The scan reads a frond's TypeScript sources off disk through jiti at boot, so
 * these packages must stay out of the server bundle and be `import`ed at runtime.
 * This is Next's own supported option for exactly that case — no webpack plugin,
 * no aliasing, no indirection to defeat a bundler.
 */
const config: NextConfig = {
  serverExternalPackages: [
    '@fougere/app',
    '@fougere/core',
    '@fougere/next',
    '@fougere/schema-sql',
    'better-sqlite3',
    'jiti',
    'typescript',
  ],
};

export default config;
