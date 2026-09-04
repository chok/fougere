import type { SchemaView } from '@fougere/schema';
import type { BindingPlan } from './binding.js';
import type { Signature, TypeRef, Param } from './signature.js';

/** The contract of one operation — everything the façade needs to serve a call. */
export interface OperationContract {
  /** Judged on the way in. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /** Projected on the way out. */
  output?: SchemaView;
  /** Where each argument is read from in the invocation. */
  binding?: BindingPlan;
  /** The operation in words, for a caller that meets it over the wire and has to choose. */
  description?: string;
  /** How MUCH comes back — the half of the return type that `output` cannot say. */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
  /** The argument names and TYPES — the one thing `binding` cannot say. */
  signature?: Signature;
}

/** Read an op's cardinality off its parsed return type. */
export function cardinalityOf(type: TypeRef | undefined): OperationContract['cardinality'] {
  if (!type) return undefined;
  const inner = type.name === 'Promise' ? type.generics?.[0] : type;
  if (!inner) return 'none';
  if (inner.name === 'ListResult') return 'page';
  if (inner.array) return 'many';
  if (PRIMITIVE_RETURNS.has(inner.name)) return 'none';
  return inner.nullable || inner.undefined ? 'maybe' : 'one';
}

/** A return that carries no schema — the card has nothing to project onto it. */
const PRIMITIVE_RETURNS = new Set(['boolean', 'string', 'number', 'void', 'undefined', 'unknown', 'any']);

/** Map of operation name → its contract. */
export type OperationsMap = Map<string, OperationContract>;

export type { TypeRef, Param };

// ─── Operation intent (read vs write) ──────────
// Naming convention for inferred handlers — scheduled to die with the
// handler-kind plan (docs/notes/handler-kind.md). Lives here, NOT in
// @fougere/schema: it is a runtime convention about operations, not a
// schema concept.

export type OperationKind = 'query' | 'command';

/** The convention's evidence, including both sides when a composed name contradicts itself. */
export interface OperationKindInference {
  kind?: OperationKind;
  queryMatches: string[];
  commandMatches: string[];
}

/** Deliberately finite: */
const QUERY_VERBS = new Set([
  'all', 'check', 'count', 'exists', 'fetch', 'find', 'get', 'has', 'health', 'list',
  'load', 'mine', 'ping', 'quote', 'read', 'search', 'stats', 'status', 'who',
]);

/**
 * Leading verbs whose write intent is strong enough to infer. Domain words (`mine`,
 * `drafts`, `bySlug`) stay out: a convention may omit syntax, but may not invent intent.
 */
const COMMAND_VERBS = new Set([
  'add', 'apply', 'archive', 'assign', 'charge', 'checkout', 'complete', 'create',
  'deactivate', 'delete', 'disable', 'edit', 'enable', 'execute', 'link', 'move', 'notify',
  'open', 'pay', 'post', 'publish', 'queue', 'rebuild', 'record', 'refresh', 'refund',
  'reindex', 'remove', 'rename', 'republish', 'reserve', 'restore', 'retitle', 'run',
  'schedule', 'send', 'set', 'settle', 'stop', 'sync', 'toggle', 'track', 'transfer',
  'unassign', 'update', 'upsert', 'withdraw', 'write',
]);

const COMPOUND_CONNECTORS = new Set(['and', 'or', 'then']);

/** The two lists, for a refusal that has to say what a name could have led with. */
export function knownVerbs(): { query: string[]; command: string[] } {
  return { query: [...QUERY_VERBS].sort(), command: [...COMMAND_VERBS].sort() };
}

/** `getOrCreatePost` → `['get', 'or', 'create', 'post']`; `hash` never becomes `has`. */
function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** Infer only when the leading word names one convention and a composed clause does not name the opp… */
export function inferOperationKind(name: string): OperationKindInference {
  const words = wordsOf(name);
  const first = words[0];
  const primary = first && QUERY_VERBS.has(first)
    ? 'query'
    : first && COMMAND_VERBS.has(first)
      ? 'command'
      : undefined;

  if (!primary) return { kind: undefined, queryMatches: [], commandMatches: [] };

  const queryMatches = primary === 'query' ? [first] : [];
  const commandMatches = primary === 'command' ? [first] : [];
  for (let i = 1; i < words.length; i++) {
    if (!COMPOUND_CONNECTORS.has(words[i - 1])) continue;
    if (QUERY_VERBS.has(words[i])) queryMatches.push(words[i]);
    if (COMMAND_VERBS.has(words[i])) commandMatches.push(words[i]);
  }

  return {
    kind: queryMatches.length > 0 && commandMatches.length === 0
      ? 'query'
      : commandMatches.length > 0 && queryMatches.length === 0
        ? 'command'
        : undefined,
    queryMatches,
    commandMatches,
  };
}

/** Explicit config is authoritative; otherwise the finite convention may decline. */
export function resolveOperationKind(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): OperationKind | undefined {
  return overrides?.[name]?.kind ?? inferOperationKind(name).kind;
}

/**
 * Compatibility for boolean readers. An indeterminate name throws: returning `false`
 * here would recreate the silent command fallback this module exists to prevent.
 */
export function isReadOp(name: string): boolean {
  return requireOperationKind(name) === 'query';
}

/** Resolve an explicit/conventional kind for existing adapters, never by fallback. */
export function resolveIsReadOp(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): boolean {
  return requireOperationKind(name, overrides) === 'query';
}

function requireOperationKind(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): OperationKind {
  const kind = resolveOperationKind(name, overrides);
  if (kind) return kind;
  throw new Error(
    `Cannot infer operation kind from '${name}'. `
    + `Declare operations.${name}.kind as 'query' or 'command' in frond.config.ts.`,
  );
}


