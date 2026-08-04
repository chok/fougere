import type { SchemaLike } from '@fougere/schema';
import type { BindingPlan } from './binding.js';
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
  /** The scan's raw material, when it produced this contract. `binding` wins. */
  signature?: ParsedMethod;
}

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
