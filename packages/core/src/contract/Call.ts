import { Invocation, type InvocationInput } from './Invocation.js';
import type { RouteAddress } from './RouteAddress.js';

/** One normalized request: where it goes and what the caller supplied. */
export class Call {
  readonly address: RouteAddress;
  readonly invocation: Invocation;

  /** Freezes a request into one value, whatever entry produced it. */
  constructor(address: RouteAddress, invocation?: InvocationInput) {
    this.address = address;
    this.invocation = Invocation.from(invocation);
    Object.freeze(this);
  }

  /** Keeps the destination and swaps what the caller supplied — how a middleware rewrites input. */
  withInvocation(invocation: Invocation): Call {
    return new Call(this.address, invocation);
  }
}
