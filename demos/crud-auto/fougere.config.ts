import '@fougere/adapter-rest';
import '@fougere/adapter-graphql';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

/**
 * What this app publishes. Both surfaces, declared once — the server mounts facades
 * and does not decide what they serve.
 */
export default defineFougere({
  sources: { main: { path: ':memory:' } },
  protocols: { rest: {}, graphql: {} },
  fronds: { '@fougere/log': {} },
});
