import { createRequire } from 'node:module';
import { resolveConventions } from '@fougere/core';
import { frondAliases, loadConfig, projectRootOf } from '@fougere/core/node';

/** The vitest configuration a Fougère project needs, `@fronds/<name>` included. */
export async function fougereTest(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const root = projectRootOf(process.cwd());
  const fronds = await frondAliases(root, resolveConventions((await loadConfig(root)).conventions));
  const require = createRequire(import.meta.url);
  let graphqlDir: string | undefined;
  try {
    graphqlDir = require.resolve('graphql').replace(/\/index\.js$/, '');
  } catch {
  }

  const base = {
    resolve: graphqlDir ? { alias: { ...fronds, graphql: graphqlDir }, dedupe: ['graphql'] } : { alias: fronds },
    test: {
      include: ['tests/**/*.test.ts', 'fronds/*/tests/**/*.test.ts'],
      server: { deps: { inline: [/@fougere\//, '@pothos/core'] } },
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
