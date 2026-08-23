import type { EntityOrm } from '../../../../../src/index.js';
import type Ledger from '../entities/Ledger.js';

/** Reaches around the aggregate — must be refused at boot. */
export default class LedgerHandler {
  constructor(private lines: EntityOrm<Ledger>) {}

  async all() { return this.lines.list(); }
}
