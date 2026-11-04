import type Account from '../entities/Account.js';
import type Receipt from '../entities/Receipt.js';

export default class AccountHandler {
  async settle(): Promise<Account | Receipt> {
    return { id: 'a', name: 'n', secret: 's' } as Account;
  }

  async settleAll(): Promise<(Account | Receipt)[]> {
    return [];
  }

  async describe(): Promise<Account | string> {
    return 'none';
  }

  async find(): Promise<Account | null> {
    return null;
  }

  async count(): Promise<number | string> {
    return 0;
  }
}
