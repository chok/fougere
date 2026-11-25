import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

/**
 * The whole configuration. `main` is a SQLite file, its tables are written by
 * `fougere migrate` from the entities, and the seeds run once.
 *
 * Give the blog frond a process of its own under `processes:`, as `demos/nuxt-blog` does,
 * and it answers over JSON-RPC instead of in memory — the pages, the handler and the
 * entity do not change by a comma. That is the same statement `demos/nuxt-blog` makes, and it is
 * the reason this demo exists: the topology is a property of the app, not of the host.
 */
export default defineFougere({
  sources: { main: { type: 'sqlite', path: 'fougere.db' } },
  // What this app publishes. Absent means not served — the route file existing is
  // not the decision, this is.
  protocols: { rest: {} },
  platform: [log()],
});
