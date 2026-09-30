import CardPayment from './CardPayment.js';

export default class RetryingCardPayment extends CardPayment {
  constructor(private inner: CardPayment) {
    super();
  }

  get network() {
    return this.inner.network;
  }

  charge(amountCents: number) {
    const said = this.inner.charge(amountCents);

    return { ...said, provider: `retrying(${said.provider})` };
  }
}
