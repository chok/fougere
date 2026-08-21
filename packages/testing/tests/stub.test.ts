/**
 * A double stands where a port stood, and carries what the port carries.
 *
 * The methods are read from the prototype rather than listed here: a stand-in that does
 * not carry what its type promises is exactly the failure `core/tests/ports.test.ts`
 * records — `charge is not a function`, from a signature TypeScript had blessed.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp, methodsOf, stubOf } from '../src/index.js';
import Payment from './fixtures/fronds/billing/services/Payment.js';

const root = join(import.meta.dirname, 'fixtures');

describe('a double', () => {
  it('carries every method the port declares', () => {
    expect(methodsOf(Payment).sort()).toEqual(['charge', 'refund']);
  });

  it('answers on all of them, and returns nothing until told', () => {
    const double = stubOf<Payment>(Payment);

    expect(typeof double.charge).toBe('function');
    expect(double.charge(1)).toBeUndefined();
  });
});

describe('a stubbed port', () => {
  it('is what the handler receives, in place of the realization', async () => {
    await using app = await testApp({ root, stub: [Payment] });
    app.stub(Payment).charge.mockReturnValue({ provider: 'test', cents: 4990 });

    const out = await createLocalRunner(app)({ entity: 'order', op: 'pay' }, EMPTY_INVOCATION);

    expect(out).toEqual({ provider: 'test', cents: 4990 });
  });

  it('records what it was called with', async () => {
    await using app = await testApp({ root, stub: [Payment] });

    await createLocalRunner(app)({ entity: 'order', op: 'pay' }, EMPTY_INVOCATION);

    expect(app.stub(Payment).charge).toHaveBeenCalledWith(4990);
  });

  it('leaves the realization in place when nothing is stubbed', async () => {
    await using app = await testApp({ root });

    const out = await createLocalRunner(app)({ entity: 'order', op: 'pay' }, EMPTY_INVOCATION);

    // `StripePayment extends Payment` IS the registration — the port resolves to it.
    expect(out).toEqual({ provider: 'stripe', cents: 4990 });
  });

  it('refuses a class nobody answers under, rather than standing in front of no one', async () => {
    class Nowhere { send(): void {} }

    await expect(testApp({ root, stub: [Nowhere] })).rejects.toThrow(/nothing answers under that name/);
  });
});
