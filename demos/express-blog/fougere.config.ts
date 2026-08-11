import { defineFougere } from '@fougere/core';

/**
 * The whole configuration. `db: 'sqlite'` resolves the storage, the tables are
 * derived from the entities at boot, and the seeds run once.
 *
 * Uncomment `remotes:` and the blog frond answers from its own process over
 * JSON-RPC instead of in memory — the pages, the handler and the entity do not
 * change by a comma. That is the same statement `demos/nuxt-blog` makes, and it is
 * the reason this demo exists: the topology is a property of the app, not of the host.
 */
export default defineFougere({
  db: 'sqlite',
  // What this app publishes. Absent means not served — the route file existing is
  // not the decision, this is.
  adapters: { rest: true, graphql: true },
  // remotes: { blog: 'http://127.0.0.1:4100' },
});
