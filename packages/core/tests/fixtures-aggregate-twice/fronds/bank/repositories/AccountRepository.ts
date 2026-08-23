import { Repository } from '../../../../../src/index.js';
import Account from '../entities/Account.js';
import Ledger from '../entities/Ledger.js';

/**
 * The aggregate. `balance` and the sum of `amount` are one fact, so both entities are
 * owned here and the rule that ties them is ordinary TypeScript inside `withdraw`.
 */
export default class AccountRepository extends Repository(Account, Ledger) {
  async withdraw(id: string, amount: number) {
    const [accounts, ledger] = this.orms;
    const account = await accounts.findById(id);
    await accounts.update(id, { balance: account!.balance - amount });
    await ledger.create({ account: id, amount: -amount });
    return account;
  }
}
