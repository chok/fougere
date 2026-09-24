import type Account from '../entities/Account.js';
import type Ledger from '../entities/Ledger.js';

export default class TransferHandler {
  async health(label: string): Promise<string> {
    return label;
  }

  async open(account: Account): Promise<string> {
    return account.id;
  }

  async transfer(source: Account, destination: Ledger): Promise<string> {
    return `${source.id}:${destination.id}`;
  }

  async transferReversed(destination: Ledger, source: Account): Promise<string> {
    return `${source.id}:${destination.id}`;
  }
}
