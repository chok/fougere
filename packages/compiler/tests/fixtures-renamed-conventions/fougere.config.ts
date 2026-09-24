import { defineFougere } from '@fougere/core';

export default defineFougere({
  db: false,
  conventions: {
    scope: '@presse',
    fronds: 'domains',
    dirs: { entities: 'models', handlers: 'usecases', services: 'helpers' },
  },
});
