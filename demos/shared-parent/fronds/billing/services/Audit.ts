import type { Call, Dispatcher } from '@fougere/core';
import Money from './Money.js';

/**
 * It names no frond and no entity, and it stands in front of every call of the family.
 *
 * `Money` comes from `billing`'s own scope: an inherited link takes its dependencies where it was
 * declared, which is inheriting the code and not the context.
 */
export default class Audit implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher, private money: Money) {}

  async dispatch(call: Call): Promise<unknown> {
    const answer = await this.inner.dispatch(call);
    console.log(`  audit  ${call.address.address}.${call.address.operation} → ${this.money.format(1250)}`);

    return answer;
  }
}
