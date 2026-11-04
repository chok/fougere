import type Account from '../entities/Account.js';
import type Receipt from '../entities/Receipt.js';

export default class AccountHandler {
  async settle(): Promise<Account | Receipt> {
    return { id: 'a', name: 'n', secret: 's' } as Account;
  }
}
