import type { FougereNames } from './FougereNames.js';

/**
 * One kind's union, or `string` where nothing was generated.
 *
 * A conditional and never `Partial<FougereNames>`: an un-augmented interface makes that
 * `Partial<{}>`, which in TypeScript means "anything non-nullish" — the silent hole `adapters:`
 * already has. Falling back to `string` is what a config had before this file existed.
 */
export type NameOf<K extends string> = FougereNames extends Record<K, infer Found extends string>
  ? Found
  : string;
