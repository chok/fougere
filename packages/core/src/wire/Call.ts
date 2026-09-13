import { Invocation, type PartialInvocation } from './Invocation.js';
import type { RouteAddress } from './RouteAddress.js';

/** One normalized request, frozen: where it goes and what the caller supplied. */
export class Call {
  readonly address: RouteAddress;
  readonly invocation: Invocation;

  constructor(address: RouteAddress, invocation?: PartialInvocation) {
    this.address = address;
    this.invocation = Invocation.from(invocation);
    Object.freeze(this);
  }
}
