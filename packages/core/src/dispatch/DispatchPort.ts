import type { Call } from '../wire/Call.js';

/** The only capability an entry needs. */
export interface DispatchPort {
  dispatch(call: Call): Promise<unknown>;
}
