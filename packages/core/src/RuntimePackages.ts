/** What a Fougere boot loads at RUNTIME, so a bundler must leave it alone. */
export const RUNTIME_PACKAGES: readonly string[] = [
  '@fougere/app',
  '@fougere/core',
  '@fougere/schema',
  '@fougere/registry',
  '@fougere/defaults',
  '@fougere/transport-http',
  '@fougere/adapter-sql',
  '@fougere/adapter-graphql',
  '@fougere/auth-better',
  'better-sqlite3',
  'jiti',
  // Optional, and imported only to scan: a bundle that held it would ship TypeScript.
  '@fougere/compiler',
];
