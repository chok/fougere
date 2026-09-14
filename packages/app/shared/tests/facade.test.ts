/**
 * What a page may name, and what it may not.
 *
 * The module the scan writes fills `FougereOperations` from outside; the augmentation below stands
 * in for it, so every claim here is read by the compiler `pnpm typecheck` runs — vitest erases
 * types without checking them, which is why `tsconfig.test.json` exists at all.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { ErrorCode } from '@fougere/core/contract';
import { addressOf, callOf, facade } from '../src/Designation.js';
import type { Addresses, Refused } from '@fougere/core/contract';

declare module '@fougere/core/contract' {
  interface FougereOperations {
    'order.quote': { kind: 'query'; errors: never };
    'order.ship': { kind: 'command'; errors: ErrorCode.CONFLICT | ErrorCode.GONE };
    'checkout.pay': { kind: 'command'; errors: ErrorCode.BAD_REQUEST };
  }
}

class Order extends entity({ id: primary(), reference: text() }) {}

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Only `true` is admitted, so a widened or narrowed answer fails where it is written. */
function exact<Holds extends true>(_holds: Holds): void {}

describe('the facades a page may name', () => {
  it('reads the addresses off the keys, and nothing else', () => {
    exact<Exact<Addresses, 'order' | 'checkout'>>(true);

    // @ts-expect-error — no facade of this app answers at 'ledger'.
    facade('ledger');
  });

  /**
   * What an operation refuses cannot be read from the handler's type: TypeScript records
   * nothing about what a function throws. It comes from the scan's walk, keyed by the pair.
   */
  it('narrows what one facade refuses, both halves together', () => {
    exact<Exact<Refused<'order', 'ship'>, ErrorCode.CONFLICT | ErrorCode.GONE>>(true);
    exact<Exact<Refused<'checkout', 'pay'>, ErrorCode.BAD_REQUEST>>(true);

    // A facade this app does not serve answers every code, which is what a client had before
    // any of this existed.
    exact<Exact<Refused<'ledger', 'post'>, ErrorCode>>(true);
  });
});

describe('the two ways to write one address', () => {
  /**
   * 17 of the 41 handlers in this tree answer at an address no entity class carries. The class
   * was never the subject anyway — it is read for its name and nothing else.
   */
  it('takes the address itself from a facade with no class to name it', () => {
    expect(addressOf('checkout')).toBe('checkout');
    expect(callOf('checkout', 'pay')).toEqual({ entity: 'checkout', op: 'pay' });
  });

  it('answers the same thing either way for a facade that has both', () => {
    expect(addressOf(Order)).toBe(addressOf('order'));
  });
});
