import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  sources: { main: { path: '.fougere/catalog.db' } },
  fronds: { '@fougere/log': {} },
});
