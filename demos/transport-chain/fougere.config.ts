import { defineFougere } from '@fougere/core';

/**
 * `catalog` runs elsewhere. What this demo adds to that statement is HOW the call gets
 * there — a list read from the outside in, the same order `ports:` already uses.
 */
export default defineFougere({
  remotes: {
    catalog: 'memory://catalog',
  },
});
