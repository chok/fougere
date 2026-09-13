import type { InvocationContext } from './Invocation.js';
import type { FrondCall } from './FrondCall.js';

/** A transport executes a call somewhere else. Failures surface as thrown FougereError. */
export type Transport = (call: FrondCall, invocation: InvocationContext) => Promise<unknown>;
