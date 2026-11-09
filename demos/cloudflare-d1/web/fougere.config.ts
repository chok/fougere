import { defineFougere } from '@fougere/core';

/**
 * A consumer: it hosts nothing and stores nothing.
 *
 * No `sources:` is not a workaround for the Worker — it is what an app that owns no row
 * declares anywhere. `sources:` says what THIS PROCESS stores, never what the app can reach.
 *
 * `fronds:` is the whole topology statement. The key is the frond's name, and it does
 * two things: it excludes any local copy of that frond, and it labels an address. What
 * the address actually serves is read off its identity card at the first call — so this
 * app can name a frond whose code it does not have.
 *
 * `binding://CATALOG` is the Worker's service binding of that name — the only route to the
 * frond worker, whose public URL Cloudflare refuses from here (error 1042). `nuxt dev` runs
 * on Node, where no binding exists, so it reaches the public URL through `CATALOG_URL`.
 */
export default defineFougere({
  fronds: {
    catalog: { remote: process.env.CATALOG_URL ?? 'binding://CATALOG' },
  },
});
