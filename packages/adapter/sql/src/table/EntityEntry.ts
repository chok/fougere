import { type SchemaView } from '@fougere/schema';

export interface EntityEntry {
  name: string;
  /** A live class in-process, or one rebuilt from the card of a frond that never crossed. */
  entityClass: SchemaView;
}
