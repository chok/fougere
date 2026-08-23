import type { SchemaView } from '@fougere/schema';
import type { BindingPlan } from '../boot/binding.js';
import { computeBindingPlan } from '../boot/binding.js';
import type { HandlerEntry, FrondDescriptor } from '../scan/frond.js';
import type { ParsedMethod, ParsedType, ParsedParam } from '../scan/handler-parser.js';

/**
 * The contract of one operation — everything the façade needs to serve a call.
 *
 * Produced two ways, indistinguishable once here: the scan DERIVES it from a
 * method's parsed signature, a prefab handler DECLARES it outright. The façade
 * consumes contracts and nothing else — it knows no operation by name, and a
 * declared contract survives a scan that resolved nothing.
 */
export interface OperationContract {
  /** Judged on the way in. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /** Projected on the way out. */
  output?: SchemaView;
  /** Where each argument is read from in the invocation. */
  binding?: BindingPlan;
  /**
   * The operation in words, for a caller that meets it over the wire and has to
   * choose. Same three producers as the rest: the scan derives it from the method's
   * doc comment, a prefab declares it, config states it and wins.
   */
  description?: string;
  /**
   * How MUCH comes back — the half of the return type that `output` cannot say.
   *
   * `output` is the shape of ONE row; it is silent on whether the op hands back one,
   * several, or a page. The prefab knows (`list` returns a `ListResult`, `findById`
   * returns `T | undefined`) and the card did not, so anything generating a signature
   * from the card would have written `list(): Promise<Post[]>` — false, and a false
   * signature is worse than none.
   *
   * `none` says there is no shaped output at all (a boolean, a void), not that the op
   * returns nothing.
   */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
  /**
   * The argument names and TYPES — the one thing `binding` cannot say.
   *
   * `binding` says where an argument is read from, `cardinality` how much comes back;
   * neither gives a type, and a GraphQL argument needs one. So this is not the scan's
   * private material: a prefab fills it too, from signatures it wrote itself. `binding`
   * still wins on where an argument comes from.
   */
  signature?: ParsedMethod;
}

/**
 * Read an op's cardinality off its parsed return type.
 *
 * `Promise` is unwrapped first — it says when, not how much. `ListResult<T>` extends
 * `Array<T>`, so it must be recognised BEFORE the array test or a page would read as
 * a plain list and lose its `total`/`hasMore`.
 */
export function cardinalityOf(type: ParsedType | undefined): OperationContract['cardinality'] {
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

export type { ParsedType, ParsedParam };

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

/**
 * Deliberately finite: these are verbs whose leading use carries a stable read meaning.
 * `stats` and `check` preserve conventions already used by the project; the rest are the
 * ordinary query vocabulary shared by the built-in adapters.
 */
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

/** `getOrCreatePost` → `['get', 'or', 'create', 'post']`; `hash` never becomes `has`. */
function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/**
 * Infer only when the leading word names one convention and a composed clause does not
 * name the opposite one. This is intentionally partial: `ofBook`, `computeReport` and
 * `getOrCreateUser` have no inferred kind instead of falling through to command/query.
 */
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


/**
 * The contract of every operation a handler serves — the three producers, merged once.
 *
 * This lived inline in `buildFacade`, which made the façade the only thing that could
 * answer "what is this op's contract, really?". Anything else asking — a checker, a
 * client generator, a descriptor — had to redo the merge, and a second opinion that
 * drifts reports nothing wrong while looking at the wrong thing.
 *
 * The order is a claim about authority, not a convenience:
 *
 *   1. a prefab DECLARES what it built (`Crud(E).__ops`) — runtime, so it survives a
 *      scan that resolved nothing;
 *   2. the scan DERIVES from source — a method written in this very file is the
 *      author's own word and beats everything; a method it merely READ on a base
 *      class is a guess about someone else's code, and yields to that code's own
 *      declaration;
 *   3. `frond.config.ts` STATES — the most explicit statement, made by whoever
 *      assembles the app, and the only answer for an op inherited from an installed
 *      base class the workspace-only scan cannot see. Merged per key, so stating a
 *      `binding` alone does not erase an `input` the scan found.
 *
 * Pure: no container, no instance, no disk. The binding plan is resolved here, so
 * nothing downstream ever meets an AST.
 */
export function resolveContracts(
  handler: Pick<HandlerEntry, 'ctor' | 'operations'>,
  overrides: FrondDescriptor['operationsOverrides'],
  collectorTypeNames: Set<string>,
): OperationsMap {
  const declared = (handler.ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
  const contracts: OperationsMap = new Map(Object.entries(declared));

  for (const [opName, scanned] of handler.operations) {
    if (scanned.signature?.inherited && opName in declared) continue;
    contracts.set(opName, {
      ...scanned,
      binding: scanned.binding
        ?? (scanned.signature ? computeBindingPlan(scanned.signature.params, collectorTypeNames) : undefined),
    });
  }

  for (const [opName, override] of Object.entries(overrides ?? {})) {
    const { input, output, binding, description } = override;
    if (input === undefined && output === undefined && binding === undefined && description === undefined) continue;
    contracts.set(opName, {
      ...contracts.get(opName),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      ...(binding !== undefined && { binding }),
      ...(description !== undefined && { description }),
    });
  }

  return contracts;
}
