import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

export default defineFougere({
  protocols: { rest: {} },
  sources: { main: { type: 'sqlite', path: '.data/blog.db' } },
  platform: [log()],
  processes: {
    mail: { url: 'http://127.0.0.1:4100', fronds: ['mail'] },
  },
});
