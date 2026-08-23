import { defineFougere } from '@fougere/core';

/**
 * A consumer: it hosts nothing and stores nothing.
 *
 * `db: false` is not a workaround for the Worker — it is what an app that owns no row
 * declares anywhere. `db:` says what THIS PROCESS stores, never what the app can reach.
 *
 * `remotes:` is the whole topology statement. The key is the frond's name, and it does
 * two things: it excludes any local copy of that frond, and it labels an address. What
 * the address actually serves is read off its identity card at the first call — so this
 * app can name a frond whose code it does not have.
 */
export default defineFougere({
  db: false,
  adapters: { rest: false, graphql: false },
  remotes: {
    catalog: process.env.CATALOG_URL ?? 'https://fougere-catalog.maxime-picaud-240.workers.dev',
  },
});
