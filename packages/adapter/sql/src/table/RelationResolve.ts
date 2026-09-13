import { type SchemaView } from '@fougere/schema';
import type { HostedNames } from './HostedNames.js';

/** How a `ref()` field's target table+column is resolved — see {@link referenceFor}. */
export interface RelationResolve {
  /** Same resolver used for every entity's own table (default or a custom `tableName`). */
  resolve: (name: string) => string;
  /** Live entity class → its already-resolved table name, reused instead of re-derived. */
  tableNameOf?: Map<SchemaView, string>;
  /** Which entities this batch holds and which live in another source — decided by NAME. */
  hosted?: HostedNames;
}
