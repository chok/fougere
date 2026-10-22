/** What this app hosts — what it STATED. */
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { Fronds } from '../descriptor/Fronds.js';

/**
 * A frond as this boot will write on it — the boot stamps `extends` and each handler's resolved
 * contracts, and a statement handed to a second boot must not arrive carrying the first one's answers.
 */
const ownCopy = (frond: FrondDescriptor): FrondDescriptor =>
  ({ ...frond, handlers: frond.handlers.map((handler) => ({ ...handler })) });

/** What the app hosts, each frond its own copy. */
export function hostedBy(fronds: readonly FrondDescriptor[]): Fronds {
  return Fronds.list(fronds.map(ownCopy));
}
