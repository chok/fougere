import { frond } from '../../src/index.js';
import { op, param } from '../contract.js';
import Account from './fronds/bank/entities/Account.js';
import Ledger from './fronds/bank/entities/Ledger.js';
import AccountHandler from './fronds/bank/handlers/AccountHandler.js';
import AccountRepository from './fronds/bank/repositories/AccountRepository.js';
import LedgerHandler from './fronds/bank/handlers/LedgerHandler.js';

export default [frond('bank', {
  entities: [Account, Ledger],
  providers: [{ ctor: AccountRepository, deps: ['AccountStorage', 'LedgerStorage'] }],
  handlers: [
    {
      ctor: AccountHandler,
      deps: ['AccountRepository'],
      operations: {
        withdraw: op({ args: [param('id')], output: Account, cardinality: 'maybe', description: 'Take money out, and journal it.' }),
      },
    },
    { ctor: LedgerHandler, deps: ['LedgerStorage'], operations: { all: op({ output: Ledger, cardinality: 'page' }) } },
  ],
})];
