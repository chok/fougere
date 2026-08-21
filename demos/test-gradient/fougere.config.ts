import { defineFougere } from '@fougere/core';

export default defineFougere({
  db: 'sqlite',
  adapters: { rest: true, graphql: true },
});
