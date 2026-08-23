import { defineFougere } from '../../src/index.js';

export default defineFougere({
  db: false,
  conventions: {
    scope: '@presse',
    fronds: 'domains',
    dirs: { entities: 'models', handlers: 'usecases', services: 'helpers' },
  },
});
