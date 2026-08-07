import type { SchemaLike } from '@fougere/schema';
import type { BindingPlan } from './binding.js';
import { computeBindingPlan } from './binding.js';
import type { HandlerEntry, FrondDescriptor } from './types.js';
import type { ParsedMethod, ParsedType, ParsedParam } from './handler-parser.js';

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
  input?: SchemaLike;
  /** Projected on the way out. */
  output?: SchemaLike;
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
  /** The scan's raw material, when it produced this contract. `binding` wins. */
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
  return inner.nullable ? 'maybe' : 'one';
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

const READ_PREFIXES = ['list', 'find', 'get', 'search', 'count', 'exists', 'stats'];

/** Convention-based: returns true if the operation name implies a read (query/GET). */
export function isReadOp(name: string): boolean {
  return READ_PREFIXES.some((p) => name.startsWith(p));
}

/**
 * Resolve operation kind honoring per-op overrides (from frond.config.ts).
 * Precedence: explicit override wins over convention.
 */
export function resolveIsReadOp(
  name: string,
  overrides?: Record<string, { kind?: 'query' | 'command' }>,
): boolean {
  const kind = overrides?.[name]?.kind;
  if (kind) return kind === 'query';
  return isReadOp(name);
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
  collectorEntityNames: Set<string>,
): OperationsMap {
  const declared = (handler.ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
  const contracts: OperationsMap = new Map(Object.entries(declared));

  for (const [opName, scanned] of handler.operations) {
    if (scanned.signature?.inherited && opName in declared) continue;
    contracts.set(opName, {
      ...scanned,
      binding: scanned.binding
        ?? (scanned.signature ? computeBindingPlan(scanned.signature.params, collectorEntityNames) : undefined),
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
