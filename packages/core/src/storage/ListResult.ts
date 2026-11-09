import type { listed } from '../wire/Listed.js';

/** What `list()` answers: an array carrying what the storage said about the rest of the rows. */
export interface ListResult<T> extends Array<T> {
  readonly [listed]?: true;
  /** Total number of matching records (only set when count: true). */
  total?: number;
  /** Cursor of the last item (for cursor-based pagination). */
  endCursor?: string;
  /** Whether more records exist after endCursor. */
  hasMore?: boolean;
}
