import { Registry } from '@fougere/registry';
import type { OperationKind } from './OperationKind.js';

/** Deliberately finite. */
const QUERY = [
  'all', 'can', 'check', 'count', 'exists', 'fetch', 'find', 'get', 'has', 'health', 'is',
  'list', 'load', 'mine', 'ping', 'quote', 'read', 'search', 'stats', 'status', 'who',
];

/**
 * Leading verbs whose write intent is strong enough to infer. Domain words (`mine`,
 * `drafts`, `bySlug`) stay out: a convention may omit syntax, but may not invent intent.
 */
const COMMAND = [
  'add', 'apply', 'archive', 'assign', 'charge', 'checkout', 'complete', 'create',
  'deactivate', 'delete', 'disable', 'edit', 'enable', 'execute', 'link', 'move', 'notify',
  'open', 'pay', 'post', 'publish', 'queue', 'rebuild', 'record', 'refresh', 'refund',
  'reindex', 'remove', 'rename', 'republish', 'reserve', 'restore', 'retitle', 'run',
  'schedule', 'send', 'set', 'settle', 'stop', 'sync', 'toggle', 'track', 'transfer',
  'unassign', 'update', 'upsert', 'withdraw', 'write',
];

/**
 * The verbs an operation's name may lead with, and the kind each one tells. A frond whose subject
 * has a verb of its own teaches it once, in a `vocabulary/` file — `Verbs.term('total', 'query')`,
 * listed in the statement's `vocabulary` — rather than stating the kind op by op. It holds for the process.
 */
export const Verbs = new Registry<OperationKind>(
  'verb',
  "export Verbs.term('<verb>', 'query' | 'command') from a file in vocabulary/",
  [...QUERY.map((verb) => [verb, 'query'] as const), ...COMMAND.map((verb) => [verb, 'command'] as const)],
);
