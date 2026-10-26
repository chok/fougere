import { type Source } from '@fougere/core';

/** One source: what realizes it, and the entities it holds — no `rows` on the default one. */
export interface SourceEntities {
  source: Source;
  rows?: string[];
  values?: string[];
  /** Nothing is written there, so it never holds the rest. */
  readOnly?: true;
}
