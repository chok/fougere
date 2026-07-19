import type { SchemaLike } from '@fougere/schema';
import type { ParsedMethod, ParsedType, ParsedParam } from './handler-parser.js';

/** Metadata for a custom handler operation. */
export interface OperationMeta {
  /** Input schema (Entity-like) — resolved from named exports if available. */
  input?: SchemaLike;
  /** Output schema (Entity-like) — resolved from named exports if available. */
  output?: SchemaLike;
  /** Full parsed signature from source (params, return type, generics). */
  signature?: ParsedMethod;
}

/** Map of method name → operation metadata. */
export type OperationsMap = Map<string, OperationMeta>;

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
