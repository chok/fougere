import { FougereError, ErrorCode } from '@fougere/core';
import Payment from './Payment.js';

export default class CardPayment extends Payment {
  async charge(cents: number): Promise<string> {
    if (cents <= 0) throw new FougereError({ code: ErrorCode.UNPROCESSABLE_ENTITY, message: 'nothing to charge' });

    return 'charged';
  }
}
