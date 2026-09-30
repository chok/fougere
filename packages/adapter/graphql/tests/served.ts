import type { SchemaView } from '@fougere/schema';

/** What core's table says of a Crud-like facade: every op it holds, each answering `output`. */
export function served(facade: Record<string, unknown> | undefined, output: SchemaView | undefined): Map<string, unknown> {
  return new Map(Object.keys(facade ?? {}).map((op) => [op, { kind: 'query', output }]));
}
