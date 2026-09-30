import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, FougereError, ErrorCode } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';
import { op } from './contract.js';

class CheckoutHandler {
  async pay(): Promise<never> {
    throw new FougereError({ code: ErrorCode.UNPROCESSABLE_ENTITY, message: 'Nothing to pay' });
  }
}

const fronds = [frond('shop', {
  handlers: [{ ctor: CheckoutHandler, operations: { pay: op({ description: 'Charge the cart.' }) } }],
})];

describe('a refusal names where it happened', () => {
  it('is addressed by the facade it crosses, not by the thrower', async () => {
    await using app = await createApp({ fronds, createContainer });

    await expect(createLocalRunner(app)({ address: 'checkout', op: 'pay' }, Invocation.empty))
      .rejects.toMatchObject({ code: ErrorCode.UNPROCESSABLE_ENTITY, address: 'checkout', operation: 'pay' });
  });

  it('keeps the address a deeper facade wrote', () => {
    const refused = new FougereError({ code: ErrorCode.NOT_FOUND, message: 'no such product' })
      .at('product', 'findById')
      .at('cart', 'add');

    expect(refused).toMatchObject({ address: 'product', operation: 'findById' });
  });
});
