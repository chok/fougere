import type { Together } from '@fougere/core';
import type Account from '../entities/Account.js';
import type Ledger from '../../accounting/entities/Ledger.js';

/** Two frames that share a member, one opened inside the other. */
export default class NestedHandler {
  constructor(
    private outer: Together<[Account, Ledger]>,
    private inner: Together<[Ledger, Account]>,
  ) {}

  /** The inner frame fails; what happens to the outer one's writes is the question. */
  async nest(): Promise<{ ok: true }> {
    return this.outer.run(async ([accounts]) => {
      await accounts.update('a', { balance: 900 });
      await this.inner.run(async ([ledger]) => {
        await ledger.create({ id: 'nested', from: 'a', to: 'b', amount: 1 });
        throw new Error('inner boom');
      });
      return { ok: true as const };
    });
  }
}
