import '@fougere/adapter-rest';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  protocols: { rest: {} },
  fronds: {
    blog: {},
    mail: { remote: 'http://127.0.0.1:4100' },
  },
});
