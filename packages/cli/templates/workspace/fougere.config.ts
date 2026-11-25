import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';

export default defineFougere({
  platform: [log()],
});
