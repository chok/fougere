import '@fougere/adapter-rest';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

export default defineFougere({
  protocols: { rest: {} },
  sources: { main: { type: 'sqlite', path: '.data/blog.db' } },
  platform: [log()],
});
