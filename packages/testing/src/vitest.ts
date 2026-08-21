import { createRequire } from 'node:module';

/**
 * The vitest configuration a Fougere project needs, so nobody has to discover it.
 *
 * One thing to know, and it is not obvious: `graphql` guards its types with `instanceOf`,
 * so a schema built by one loaded copy is refused by another with *"from another module
 * or realm"*. Under vitest a module is either transformed by Vite or externalized and
 * loaded by node, and Pothos ending up on one side while `graphql()` sits on the other
 * makes two copies of the same file. The alias pins the path, and the inlining makes the
 * packages that touch it take that path — neither alone is enough, which is what made
 * this cost an afternoon.
 *
 * An app that serves no GraphQL pays nothing for this: the alias resolves to whatever
 * `graphql` the project has, and no `graphql` means the option is simply unused.
 *
 * ```ts
 * // vitest.config.ts
 * import { fougereTest } from '@fougere/testing/vitest';
 * export default fougereTest();
 * ```
 */
export function fougereTest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const require = createRequire(import.meta.url);
  let graphqlDir: string | undefined;
  try {
    graphqlDir = require.resolve('graphql').replace(/\/index\.js$/, '');
  } catch {
    // No GraphQL in this project — nothing to pin.
  }

  const base = {
    resolve: {
      ...(graphqlDir ? { alias: { graphql: graphqlDir }, dedupe: ['graphql'] } : {}),
    },
    test: {
      // Both spellings of where a test lives: beside the frond it is about, and above
      // the fronds when it is about several of them.
      include: ['tests/**/*.test.ts', 'fronds/*/tests/**/*.test.ts'],
      server: { deps: { inline: [/@fougere\//, '@pothos/core'] } },
    },
  };

  return {
    ...base,
    ...overrides,
    resolve: { ...base.resolve, ...(overrides.resolve as object ?? {}) },
    test: { ...base.test, ...(overrides.test as object ?? {}) },
  };
}
