import { defineFougere } from '@fougere/core';

/**
 * Byte-identical to `demos/next-blog/fougere.config.ts`. That is the demo.
 */
export default defineFougere({
  db: 'sqlite',
  // What this app publishes. Absent means not served — the route file existing is
  // not the decision, this is.
  adapters: { rest: true },
  // remotes: { blog: 'http://127.0.0.1:4100' },
});
