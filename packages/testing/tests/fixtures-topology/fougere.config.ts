import { defineFougere } from '@fougere/core';

export default defineFougere({
  db: { dialect: 'sqlite' },
  fronds: {
    billing: 'http://127.0.0.1:1',
  },
});
