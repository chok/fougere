import Money from '../../shop/services/Money.js';

/** Outside the family: the same dependency, and nothing resolves it here. */
export default class PostHandler {
  constructor(private money: Money) {}

  /** What a post costs, which is a question it should not be able to ask. */
  async quote(): Promise<string> {
    return this.money.format(100);
  }
}
