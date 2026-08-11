import { defineFougere } from '@fougere/core';

/**
 * What this app publishes. Both surfaces, declared once — the server mounts doors
 * and does not decide what they serve.
 */
export default defineFougere({
  db: { dialect: 'sqlite', path: ':memory:' },
  adapters: { rest: true, graphql: true },
});
