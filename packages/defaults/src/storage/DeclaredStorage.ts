import { type Source } from '@fougere/core';
import type { DbConfig } from './DbConfig.js';
import type { Placement } from './Placement.js';

/** Does this config ask for persistence at all? */
export function declaresStorage(dbConf: DbConfig): boolean {
  if (dbConf === false || dbConf === undefined) return false;
  return true;
}

export interface DeclaredStorage {
  /** The default source — where an entity no placement names lands. */
  db: Source;
  /** The other places. Absent means one source, the way it always was. */
  sources?: Record<string, Placement>;
}
