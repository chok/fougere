import type { Storage } from '../../../../../src/index.js';
import type Ledger from '../entities/Ledger.js';

/** Reaches around the aggregate — must be refused at boot. */
export default class LedgerHandler {
  constructor(private lines: Storage<Ledger>) {}

  async all() { return this.lines.list(); }
}
