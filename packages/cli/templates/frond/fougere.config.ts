import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  sources: { main: { type: 'sqlite', path: '.data/app.db' } },
  fronds: { '@fougere/log': {} },
});
