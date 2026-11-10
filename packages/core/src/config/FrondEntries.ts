import type { NameOf } from '../NameOf.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

/**
 * What the config says about the fronds this app is made of.
 *
 * Documented: [fronds](https://fougere.dev/docs/concepts/configuration).
 */
export type FrondEntries = {
  readonly [frond in NameOf<'frond'> | (string & {})]?: FrondEntry;
};

/**
 * An entry: `{ remote }`, `{ options }`, or the frond itself.
 * Ex: `auth: betterAuth({ … })`.
 */
export type FrondEntry = FrondAttributes | FrondDescriptor;

export interface FrondAttributes {
  /** The frond this one inherits code from, one level only. */
  extends?: NameOf<'frond'> | (string & {});
  /** Where it answers — the address of the process that serves it. */
  remote?: string;
  /** What the host hands a module key when it imports it. */
  options?: string;
}

/** Whether a key names a module rather than a frond. */
export function statesModule(key: string): boolean {
  return key.includes('/') || key.startsWith('.');
}
