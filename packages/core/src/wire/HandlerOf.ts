import type { FougereHandlers } from './FougereHandlers.js';
import type { AnyHandler } from './AnyHandler.js';

/**
 * The handler that answers at one address. It falls back to an unconstrained facade when nothing
 * was generated, because a `never` there would refuse every call a project makes.
 */
export type HandlerOf<Address extends string> =
  [keyof FougereHandlers] extends [never] ? AnyHandler
  : Address extends keyof FougereHandlers ? FougereHandlers[Address] : AnyHandler;
