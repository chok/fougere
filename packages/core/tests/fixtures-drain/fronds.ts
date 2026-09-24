import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import SlowHandler from './fronds/ops/handlers/SlowHandler.js';

export default [frond('ops', {
  handlers: [{
    ctor: SlowHandler,
    operations: {
      work: op({ cardinality: 'one', description: 'Take a while, then answer.' }),
      boom: op({ cardinality: 'one', description: 'Refuse.' }),
      hang: op({ cardinality: 'one', description: 'Never answer — what a drain with a deadline is for.' }),
    },
  }],
  operationsOverrides: { work: { kind: 'command' }, boom: { kind: 'command' }, hang: { kind: 'command' } },
})];
