/** What this app hosts — what it STATED. */
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { Fronds } from '../descriptor/Fronds.js';

const ownCopy = (frond: FrondDescriptor): FrondDescriptor =>
  ({ ...frond, handlers: frond.handlers.map((handler) => ({ ...handler })) });

/** What the app hosts, each frond its own copy. */
export function hostedBy(fronds: readonly FrondDescriptor[]): Fronds {
  return Fronds.list(fronds.map(ownCopy));
}
