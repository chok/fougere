import type { Together } from '@fougere/core';
import type Account from '../entities/Account.js';
import type Ledger from '../../accounting/entities/Ledger.js';

/** The same frame, in a process that hosts only half of it. */
export default class TransferHandler {
  constructor(private together: Together<[Account, Ledger]>) {}

  /** Never reached: the boot refuses before the first call. */
  async move(from: string, to: string, amount: number): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await accounts.update(from, { balance: amount });
      await ledger.create({ id: 'x', from, to, amount });
      return { ok: true as const };
    });
  }
}
