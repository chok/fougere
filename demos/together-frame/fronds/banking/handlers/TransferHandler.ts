import type { Together } from '@fougere/core';
import { observe } from '../observe.js';
import type Account from '../entities/Account.js';
import type Ledger from '../../accounting/entities/Ledger.js';

/** Ledger ids, so two runs in the same millisecond do not collide. */
let line = 0;

/**
 * Two fronds, one frame — and this file says nothing about either.
 *
 * `EntityOrm<T>` is the port whose every gesture is ONE statement. `Together<[…]>` is
 * the port whose unit is a BLOCK: what the callback did happens entirely, or not at all.
 * Which realization backs it — the engine's transaction, or an unwind the frame replays
 * itself — is decided by `sources:` and announced at boot. Not here.
 */
export default class TransferHandler {
  constructor(private together: Together<[Account, Ledger]>) {}

  /** Move an amount, and write the line that says so. */
  async move(from: string, to: string, amount: number): Promise<{ ok: true }> {
    return this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      return { ok: true as const };
    });
  }

  /**
   * The same three writes, and the network dying after the last one.
   *
   * `observe()` is the demo asking an OUTSIDE reader — its own connection — what it can
   * see at that moment. It is the one question the two realizations answer differently.
   */
  async moveAndFail(from: string, to: string, amount: number): Promise<never> {
    return this.together.run(async ([accounts, ledger]) => {
      await this.write(accounts, ledger, from, to, amount);
      const inside = await accounts.findById(from);
      throw new Error(
        `the confirmation service timed out\n`
        + `           inside the block, ada is ${inside!.balance} — and an outside reader sees ${await observe?.()}`,
      );
    });
  }

  /**
   * The judge refusing the LAST write — `balance` may not go below zero.
   *
   * The ordinary refusal, not a special case: the judge sits outside the recorder, so a
   * write the entity refuses never enters the journal, and what preceded it comes back
   * like anything else.
   */
  async overdraw(from: string, to: string): Promise<never> {
    return this.together.run(async ([accounts, ledger]) => {
      await ledger.create({ id: `over-${++line}`, from, to, amount: 999 });
      await accounts.update(from, { balance: -5 });
      throw new Error('unreachable — the judge refuses before this');
    });
  }

  private async write(accounts: any, ledger: any, from: string, to: string, amount: number): Promise<void> {
    const debited = await accounts.findById(from);
    const credited = await accounts.findById(to);
    if (!debited || !credited) throw new Error('no such account');

    await accounts.update(from, { balance: debited.balance - amount });
    await accounts.update(to, { balance: credited.balance + amount });
    await ledger.create({ id: `move-${++line}`, from, to, amount });
  }
}
