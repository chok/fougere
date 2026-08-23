import type AccountRepository from '../repositories/AccountRepository.js';

/** A door onto the aggregate — the only way its members are reached. */
export default class AccountHandler {
  constructor(private accounts: AccountRepository) {}

  /** Take money out, and journal it. */
  async withdraw(id: string) { return this.accounts.withdraw(id, 100); }
}
