import type { SchemaDescriptor } from '@fougere/schema';
import type { ErrorCode } from '../ErrorCode.js';

/**
 * One operation, as a stranger meets it — its name, what it is for, what it takes and whether it
 * reads or writes.
 */
export interface CardOp {
  name: string;
  /** The author's own doc sentence, when the method carries one. */
  description?: string;
  /** JSON Schema of what it accepts, when the contract names a view. */
  input?: SchemaDescriptor;
  /** JSON Schema of what it emits, when the contract names one. */
  output?: SchemaDescriptor;
  /** `query` reads, `command` writes — the same call REST turns into GET vs POST. */
  kind: 'query' | 'command';
  /** How much `output` describes. */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
  /** What this op can REFUSE, beyond what `kind` and `input` already imply. */
  errors?: ErrorCode[];
}
