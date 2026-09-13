import { createRequire } from 'node:module';

/** The vitest configuration a Fougere project needs, so nobody has to discover it. */
export function fougereTest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const require = createRequire(import.meta.url);
  let graphqlDir: string | undefined;
  try {
    graphqlDir = require.resolve('graphql').replace(/\/index\.js$/, '');
  } catch {
    // No GraphQL in this project — nothing to pin.
  }

  const base = {
    resolve: (graphqlDir ? { alias: { graphql: graphqlDir }, dedupe: ['graphql'] } : {}),
    test: {
      // Both spellings of where a test lives: beside the frond it is about, and above
      // the fronds when it is about several of them.
      include: ['tests/**/*.test.ts', 'fronds/*/tests/**/*.test.ts'],
      server: { deps: { inline: [/@fougere\//, '@pothos/core'] } },
      // A Fougere test boots an app, and a boot runs the scan — a tsc program over the
      // project. Vitest's 5s default times that out on a cold machine, which three
      // packages had each discovered and patched on their own.
      testTimeout: 20_000,
    },
  };

  return {
    ...base,
    ...overrides,
    resolve: { ...base.resolve, ...(overrides.resolve as object ?? {}) },
    test: { ...base.test, ...(overrides.test as object ?? {}) },
  };
}
