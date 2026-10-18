import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  sources: { main: { type: 'sqlite', path: ':memory:' } },
  fronds: {
    billing: 'http://127.0.0.1:1',
  },
});
