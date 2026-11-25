import { defineFrond } from '@fougere/core/node';
import type {} from '@fougere/oclif/positional';

export default defineFrond({
  operations: {
    'serve.execute': { terminal: { positional: ['process'] } },
    'dev.execute': { terminal: { positional: ['process'] } },
    'env.execute': { terminal: { positional: ['process'] } },
  },
});
