import { Crud } from '../../../../../src/index.js';
import Ledger from '../entities/Ledger.js';

/** Automatic CRUD on an OWNED entity — it has no storage of its own to run on. */
export default class LedgerHandler extends Crud(Ledger) {}
