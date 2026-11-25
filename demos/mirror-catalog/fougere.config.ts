import '@fougere/adapter-sql';
import '@fougere/adapter-env';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

export default defineFougere({
  sources: {
    main: { type: 'sqlite', path: '.data/catalog.db' },
    env: { type: 'env', values: ['Partner'] },
  },
  platform: [log()],
});
