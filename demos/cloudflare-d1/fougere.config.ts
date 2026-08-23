import { defineFougere } from '@fougere/core';

/**
 * No `db:` key. On a Worker there is nothing to open at boot and no file to re-read:
 * the storage arrives as a BINDING, per request, and `src/worker.ts` hands it in.
 */
export default defineFougere({
  adapters: { rest: true, graphql: false },
});
