import '@fougere/adapter-rest';
import { defineFougere } from '@fougere/core';

export default defineFougere({
  protocols: { rest: {} },
  fronds: { '@fougere/log': {} },
});
