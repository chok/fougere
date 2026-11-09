import type { FougereNames } from './FougereNames.js';

/** One kind's union of names, or `string` where nothing was generated. */
export type NameOf<K extends string> = FougereNames extends Record<K, infer Found extends string>
  ? Found
  : string;
