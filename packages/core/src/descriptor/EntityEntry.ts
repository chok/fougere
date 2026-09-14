import type { SchemaView } from '@fougere/schema';

/** A discovered entity (Entity subclass in entities/ dir). */
export interface EntityEntry {
  /** Registration key: class name lowercased first char (e.g. 'product'). */
  name: string;
  /** The Entity class (has static getFields()). */
  entityClass: SchemaView;
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this entity is part of the frond's public contract. */
  exposed?: boolean;
}
