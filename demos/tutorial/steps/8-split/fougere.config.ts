import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  protocols: { rest: {} },
  sources: { main: { type: 'sqlite', path: '.data/blog.db' } },
  fronds: {
    '@fougere/log': {},
    mail: { remote: 'http://127.0.0.1:4100' },
  },
});
