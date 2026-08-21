import { defineFougere } from '@fougere/core';

export default defineFougere({
  db: { dialect: 'sqlite' },
  adapters: { rest: true, graphql: true },
});
