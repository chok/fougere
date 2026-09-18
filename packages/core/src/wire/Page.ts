/**
 * What a paged operation answers — the rows, and what the storage said about the rest of them.
 *
 * An ENVELOPE rather than the array `Storage.list` hands back: that one carries `total` and
 * `hasMore` as properties OF the array, and `JSON.stringify` keeps only the indices. Measured
 * 2026-09-18 — `page.total` is 42 in this process and `undefined` behind `fronds:`, off the same
 * code. What crosses has to be named, so it is a field.
 *
 * `Storage.list` keeps its array: it answers inside a frond and never crosses.
 */
export interface Page<Row> {
  items: Row[];
  /** Only when the caller asked to count. */
  total?: number;
  hasMore?: boolean;
  endCursor?: string;
}

/**
 * The array `Storage.list` answers, read as the page an operation hands over.
 *
 * A storage handed in by a host may answer the envelope already — `storageFactory` is its door,
 * and nothing there is obliged to subclass an array. Taken as it comes in that case.
 */
export function pageOf<Row>(rows: Page<Row> | readonly Row[]): Page<Row> {
  if (!Array.isArray(rows)) return rows as Page<Row>;

  const { total, hasMore, endCursor } = rows as unknown as Omit<Page<Row>, 'items'>;

  return {
    items: [...rows],
    ...(total !== undefined && { total }),
    ...(hasMore !== undefined && { hasMore }),
    ...(endCursor !== undefined && { endCursor }),
  };
}

/**
 * The value read as a page, or nothing.
 *
 * Read from the FORM, and arbitrated by the schema: an entity legally declaring a field named
 * `items` answers a row, not a page, and it is the only thing that could tell the two apart.
 */
export function asPage(value: unknown, fields: Record<string, unknown>): Page<unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if ('items' in fields) return undefined;
  const page = value as Page<unknown>;

  return Array.isArray(page.items) ? page : undefined;
}
