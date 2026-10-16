import { defineFougere } from '@fougere/core';

export default defineFougere({
  conventions: {
    scope: '@presse',
    fronds: 'domains',
    dirs: { entities: 'models', handlers: 'usecases', services: 'helpers' },
  },
});
