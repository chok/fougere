/** What a paged operation answers: the rows, and what the storage said about the rest. */
export interface Page<Row> {
  items: Row[];
  /** Only when the caller asked to count. */
  total?: number;
  hasMore?: boolean;
  endCursor?: string;
}

export const Page = {
  /** The page an operation hands over, from a storage's list or a page already. */
  of<Row>(rows: Page<Row> | readonly Row[]): Page<Row> {
    if (!Array.isArray(rows)) return rows as Page<Row>;

    const { total, hasMore, endCursor } = rows as unknown as Omit<Page<Row>, 'items'>;

    return {
      items: [...rows],
      ...(total !== undefined && { total }),
      ...(hasMore !== undefined && { hasMore }),
      ...(endCursor !== undefined && { endCursor }),
    };
  },
};

/** The value read as a page, or nothing; a row with a field named `items` stays a row. */
export function asPage(value: unknown, fields: Record<string, unknown>): Page<unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if ('items' in fields) return undefined;
  const page = value as Page<unknown>;

  return Array.isArray(page.items) ? page : undefined;
}
