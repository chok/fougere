import { Repository } from '../../../../../src/index.js';
import Ledger from '../entities/Ledger.js';
import Account from '../entities/Account.js';

/** A second aggregate over the same two entities — must be refused, naming both. */
export default class LedgerRepository extends Repository(Ledger, Account) {}
