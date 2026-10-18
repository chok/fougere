import '@fougere/adapter-rest';
import '@fougere/adapter-graphql';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  sources: { main: { type: 'sqlite', path: 'fougere.db' } },
  protocols: { rest: {}, graphql: {} },
  fronds: { '@fougere/log': {} },
});
