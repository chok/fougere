import { defineFougere } from '@fougere/core';

/**
 * A file, not `:memory:` — a terminal command is one process that starts and stops, so an
 * in-memory row would die between `product:create` and `product:list`. That is the one thing
 * a CLI host changes about a frond, and it is stated here rather than in the code.
 */
export default defineFougere({
  db: { dialect: 'sqlite', path: '.fougere/catalog.db' },
});
