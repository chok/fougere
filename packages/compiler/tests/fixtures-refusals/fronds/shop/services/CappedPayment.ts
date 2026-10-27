import { FougereError, ErrorCode } from '@fougere/core';
import Payment from './Payment.js';

/** A link: it asks for the port it extends, and refuses before handing over to it. */
export default class CappedPayment extends Payment {
  constructor(private inner: Payment) {
    super();
  }

  async charge(cents: number): Promise<string> {
    if (cents > 100_000) throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'too much at once' });

    return this.inner.charge(cents);
  }
}
