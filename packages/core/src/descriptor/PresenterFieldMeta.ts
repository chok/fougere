import type { Param } from '../wire/Param.js';

/** Return type metadata for a presenter computed field. */
export interface PresenterFieldMeta {
  name: string;
  /** Inferred return type name: 'string', 'number', 'boolean', or a class name. */
  returnType?: string;
  /** The field emits a LIST per row — `tags(posts: Post[]): string[][]`. */
  list?: boolean;
  /** Whether the return is nullable. */
  nullable?: boolean;
  /** The declared parameters AFTER the rows. */
  params?: Param[];
}
