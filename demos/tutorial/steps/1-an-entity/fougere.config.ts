import '@fougere/adapter-rest';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

export default defineFougere({
  protocols: { rest: {} },
  platform: [log()],
});
