import type { TypeRef, Param } from './signature.js';
import type { OperationContract } from './OperationContract.js';

/** Map of operation name → its contract. */
export type OperationsMap = Map<string, OperationContract>;

export type { TypeRef, Param };

// ─── Operation intent (read vs write) ──────────
// Naming convention for inferred handlers — scheduled to die with the
// handler-kind plan (docs/notes/handler-kind.md). Lives here, NOT in
// @fougere/schema: it is a runtime convention about operations, not a
// schema concept.
