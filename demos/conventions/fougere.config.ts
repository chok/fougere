import '@fougere/adapter-memory';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  conventions: {
    scope: '@shop',
    fronds: 'domains',
    dirs: {
      entities: 'models',
      handlers: 'endpoints',
      services: 'providers',
      seeds: 'fixtures',
      rules: 'logic',
      versions: 'history',
      vocabulary: 'terms',
      extensions: 'plugins',
    },
  },
  sources: { main: { type: 'memory' } },
});
