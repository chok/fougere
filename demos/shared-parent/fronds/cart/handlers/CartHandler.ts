import Money from '@fronds/billing/services/Money.js';

/** Nothing here names `billing`. It asks for a type, and the tree says where it lives. */
export default class CartHandler {
  constructor(private money: Money) {}

  /** What the basket comes to. */
  async quote(): Promise<string> {
    return this.money.format(1250);
  }
}
