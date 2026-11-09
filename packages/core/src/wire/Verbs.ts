import { Registry } from '@fougere/registry';
import type { OperationKind } from './OperationKind.js';

const QUERY = [
  'all', 'can', 'check', 'count', 'exists', 'fetch', 'find', 'get', 'has', 'health', 'is',
  'list', 'load', 'mine', 'ping', 'quote', 'read', 'search', 'stats', 'status', 'who',
];

/**
 * The read verbs; a frond teaches one of its own from a `vocabulary/` file.
 * Ex: `Verbs.term('total', 'query')`.
 */
export const Verbs = new Registry<OperationKind>(
  'verb',
  "export Verbs.term('<verb>', 'query') from a file in vocabulary/",
  QUERY.map((verb) => [verb, 'query'] as const),
);
