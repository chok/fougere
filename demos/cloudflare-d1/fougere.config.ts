import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

/**
 * The database is a BINDING, so the entry names the binding rather than a file or a url.
 * D1 is SQLite: the DDL, the codecs and the limits are the ones Fougere already knows.
 */
export default defineFougere({
  sources: { main: { type: 'd1', binding: 'DB' } },
  protocols: { rest: {} },
});
