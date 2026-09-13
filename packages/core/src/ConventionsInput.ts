import type { Conventions } from './Conventions.js';

/** What a `fougere.config.ts` may state: only the names that differ. */
export type ConventionsInput = {
  scope?: string;
  fronds?: string;
  dirs?: Partial<Conventions['dirs']>;
};
