import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

/**
 * Byte-identical to `demos/next-blog/fougere.config.ts`. That is the demo.
 */
export default defineFougere({
  sources: { main: { type: 'sqlite', path: 'fougere.db' } },
  // What this app publishes. Absent means not served — the route file existing is
  // not the decision, this is.
  protocols: { rest: {} },
  fronds: {
    '@fougere/log': {},
    // blog: 'http://127.0.0.1:4100',
  },
});
