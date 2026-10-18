import '@fougere/adapter-rest';
import '@fougere/adapter-graphql';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

/**
 * The whole configuration. `main` is a SQLite file, its tables are written by
 * `fougere migrate` from the entities, and the seeds run once.
 *
 * Uncomment the address below and the blog frond answers from its own process over
 * JSON-RPC instead of in memory — the pages, the handler and the entity do not
 * change by a comma. That is the same statement `demos/nuxt-blog` makes, and it is
 * the reason this demo exists: the topology is a property of the app, not of the host.
 */
export default defineFougere({
  sources: { main: { type: 'sqlite', path: 'fougere.db' } },
  // What this app publishes. Absent means not served — the route file existing is
  // not the decision, this is.
  protocols: { rest: {}, graphql: {} },
  fronds: {
    '@fougere/log': {},
    // blog: 'http://127.0.0.1:4100',
  },
});
