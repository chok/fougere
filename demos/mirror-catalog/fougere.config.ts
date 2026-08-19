import { defineFougere } from '@fougere/core';

export default defineFougere({
  db: { dialect: 'sqlite', path: '.fougere/catalog.db' },
});
