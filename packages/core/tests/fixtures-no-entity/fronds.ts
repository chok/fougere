import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import HealthHandler from './fronds/ops/handlers/HealthHandler.js';
import PublicHealthHandler from './fronds/ops/handlers/public/HealthHandler.js';

export default [frond('ops', {
  handlers: [
    { ctor: HealthHandler, operations: { check: op({ cardinality: 'one', description: 'Whether this process can answer.' }) } },
    {
      ctor: PublicHealthHandler,
      surface: 'public',
      operations: {
        check: op({ cardinality: 'one', description: 'Whether this process can answer, for a caller that may see nothing else.' }),
      },
    },
  ],
})];
