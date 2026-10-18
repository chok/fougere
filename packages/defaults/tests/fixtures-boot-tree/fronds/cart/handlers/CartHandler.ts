import Money from '../../shop/services/Money.js';

/** It asks for what its parent declared; its own file says nothing about the tree. */
export default class CartHandler {
  constructor(private money: Money) {}

  /** What the cart costs. */
  async quote(): Promise<string> {
    return this.money.format(1250);
  }
}
