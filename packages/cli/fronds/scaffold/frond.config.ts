import { defineFrond } from '@fougere/core/node';
import '@fougere/oclif/positional';

export default defineFrond({
  operations: {
    'serve.execute': { terminal: { positional: ['process'] } },
    'dev.execute': { terminal: { positional: ['process'] } },
  },
});
