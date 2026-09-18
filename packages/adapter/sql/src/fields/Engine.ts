import type { DialectName } from '../dialect/DialectName.js';

/** The engines an entry may address: the dialects this adapter speaks, and nothing else. */
export const ENGINES = ['sqlite', 'pg', 'mysql', 'mssql'] as const;

export type Engine = (typeof ENGINES)[number];

type Assert<T extends true> = T;

/** A fifth dialect does not compile until `ENGINES` names it. */
type _EnginesMatchDialects = Assert<[Exclude<DialectName, Engine>] extends [never] ? true : false>;
