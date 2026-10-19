import { Registry } from '@fougere/registry';
import type { OperationKind } from './OperationKind.js';

/** Deliberately finite. */
const QUERY = [
  'all', 'can', 'check', 'count', 'exists', 'fetch', 'find', 'get', 'has', 'health', 'is',
  'list', 'load', 'mine', 'ping', 'quote', 'read', 'search', 'stats', 'status', 'who',
];

/**
 * The read verbs. An operation whose name uses only these reads; every other one is a command, so
 * no write verb is listed. A frond whose subject has a read verb of its own teaches it once, in a
 * `vocabulary/` file — `Verbs.term('total', 'query')` — rather than stating the kind op by op.
 */
export const Verbs = new Registry<OperationKind>(
  'verb',
  "export Verbs.term('<verb>', 'query') from a file in vocabulary/",
  QUERY.map((verb) => [verb, 'query'] as const),
);
