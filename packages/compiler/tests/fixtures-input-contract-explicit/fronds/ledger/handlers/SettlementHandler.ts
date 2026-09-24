import type Account from '../entities/Account.js';
import type Ledger from '../entities/Ledger.js';

export default class SettlementHandler {
  async settle(source: Account, destination: Ledger): Promise<string> {
    return `${source.id}:${destination.id}`;
  }
}
