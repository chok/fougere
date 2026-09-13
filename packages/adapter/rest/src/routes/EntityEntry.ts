import type { SchemaView } from '@fougere/schema';

export interface EntityEntry {
  name: string;
  /** A live class in-process, a card from a frond whose class never crossed. */
  entityClass: SchemaView;
  exposed?: boolean;
}
