import { frond } from '../../src/index.js';
import { op, param } from '../contract.js';
import Account from './fronds/bank/entities/Account.js';
import Ledger from './fronds/bank/entities/Ledger.js';
import AccountHandler from './fronds/bank/handlers/AccountHandler.js';
import AccountRepository from './fronds/bank/repositories/AccountRepository.js';
import LedgerRepository from './fronds/bank/repositories/LedgerRepository.js';

export default [frond('bank', {
  entities: [Account, Ledger],
  providers: [
    { ctor: AccountRepository, deps: ['AccountStorage', 'LedgerStorage'] },
    { ctor: LedgerRepository, deps: ['LedgerStorage', 'AccountStorage'] },
  ],
  handlers: [{
      ctor: AccountHandler,
      deps: ['AccountRepository'],
      operations: {
        withdraw: op({ args: [param('id')], output: Account, cardinality: 'maybe', description: 'Take money out, and journal it.' }),
      },
    }],
})];
