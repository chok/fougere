import type { listed } from '../wire/Listed.js';

/**
 * Result of list() — an array, carrying what the storage said about the rest of the rows. Its type
 * carries the mark — a plain array is still one — so an operation declared to answer one is read as
 * the page it crosses as.
 */
export interface ListResult<T> extends Array<T> {
  readonly [listed]?: true;
  /** Total number of matching records (only set when count: true). */
  total?: number;
  /** Cursor of the last item (for cursor-based pagination). */
  endCursor?: string;
  /** Whether more records exist after endCursor. */
  hasMore?: boolean;
}
