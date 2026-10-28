import { frond } from '../../src/index.js';
import { op, param } from '../contract.js';
import Stamping from './fronds/ledger/services/Stamping.js';
import Crate from './fronds/warehouse/entities/Crate.js';
import CrateHandler from './fronds/warehouse/handlers/CrateHandler.js';
import CrateRepository from './fronds/warehouse/services/CrateRepository.js';

export default [
  frond('ledger', { providers: [{ ctor: Stamping, deps: ['Storage'] }] }),
  frond('warehouse', {
    entities: [Crate],
    providers: [{ ctor: CrateRepository, repository: Crate }],
    handlers: [{
      ctor: CrateHandler,
      deps: ['CrateRepository'],
      operations: { add: op({ args: [param('label')], cardinality: 'none', description: 'Store one crate.' }) },
    }],
  }),
];
