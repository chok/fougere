import type { FougereHandlers } from './FougereHandlers.js';
import type { AnyHandler } from './AnyHandler.js';

/** The handler that answers at one address, or any facade when nothing was generated. */
export type HandlerOf<Address extends string> =
  [keyof FougereHandlers] extends [never] ? AnyHandler
  : Address extends keyof FougereHandlers ? FougereHandlers[Address] : AnyHandler;
