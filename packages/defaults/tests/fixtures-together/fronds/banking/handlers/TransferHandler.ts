import type { Emit, Together } from '@fougere/core';
import type Account from '../entities/Account.js';
import type Moved from '../entities/Moved.js';
import type Ledger from '../../accounting/entities/Ledger.js';

/**
 * One handler, one signature — and two guarantees, decided by `sources:` alone.
 *
 * Nothing here names either. That is the whole point: the boot states which one it
 * built, and the same code runs over a transaction or over an unwind the frame
 * replays itself.
 */
export default class TransferHandler {
  constructor(private together: Together<[Account, Ledger]>, private moved: Emit<Moved>) {}

  /** Announcing from INSIDE the block — refused: the writes can still be taken back. */
  async moveAndAnnounceInside(from: string, to: string, amount: number): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      await this.moved({ id: `m-${from}`, amount });
      return { ok: true as const };
    });
  }

  /** Announcing AFTER it returns — which is when it is true. */
  async moveAndAnnounceAfter(from: string, to: string, amount: number): Promise<{ ok: true }> {
    const done = await this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      return { ok: true as const };
    });
    await this.moved({ id: `m-${from}`, amount });
    return done;
  }

  /** Move an amount, and write the line that says so. */
  async move(from: string, to: string, amount: number): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      return { ok: true as const };
    });
  }

  /** The same three writes, and a failure after the last one. */
  async moveAndFail(from: string, to: string, amount: number): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      throw new Error('boom');
    });
  }

  private async write(accounts: any, ledger: any, from: string, to: string, amount: number): Promise<void> {
    const debited = await accounts.findById(from);
    const credited = await accounts.findById(to);
    if (!debited || !credited) throw new Error('no such account');

    await accounts.update(from, { balance: debited.balance - amount });
    await accounts.update(to, { balance: credited.balance + amount });
    await ledger.create({ id: `l-${from}-${to}`, from, to, amount });
  }

  /** The judge refuses the LAST write — balance may not go below 0. */
  async overdraw(from: string, to: string): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await ledger.create({ id: `l-bad-${from}`, from, to, amount: 1 });
      await accounts.update(from, { balance: -5 });
      return { ok: true as const };
    });
  }
}
