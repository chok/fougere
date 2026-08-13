import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const graphqlDir = require.resolve('graphql').replace(/\/index\.js$/, '');

export default defineConfig({
  resolve: {
    alias: {
      // Force toutes les importations de graphql vers la même copie
      graphql: graphqlDir,
    },
    dedupe: ['graphql'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
