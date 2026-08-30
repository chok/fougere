/**
 * What a Fougere boot loads at RUNTIME, so a bundler must leave it alone.
 *
 * Stated once because it was stated twice and the two had already drifted: the Vite plugin
 * listed `@fougere/schema`, `@fougere/adapter-graphql` and `@fougere/auth-better`, the Next
 * one did not, and BOTH omitted the two packages `@fougere/app`'s boot actually imports
 * dynamically — `@fougere/defaults` and `@fougere/transport-http`. A list a bundler reads
 * has no way to notice it is wrong: nothing fails at build time, the app fails at boot.
 *
 * It sits here rather than beside the dynamic imports because both readers are BUILD-TIME
 * plugins that already depend on core, and neither may pull the boot into a bundler config.
 */
export const RUNTIME_PACKAGES: readonly string[] = [
  '@fougere/app',
  '@fougere/core',
  '@fougere/schema',
  '@fougere/defaults',
  '@fougere/transport-http',
  '@fougere/adapter-sql',
  '@fougere/adapter-graphql',
  '@fougere/auth-better',
  'better-sqlite3',
  'jiti',
  'typescript',
];
