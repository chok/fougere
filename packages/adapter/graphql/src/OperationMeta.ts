import type { SchemaView } from '@fougere/schema';
import type { ParsedSignature } from './ParsedSignature.js';
import type { OperationBinding } from './OperationBinding.js';

/** The projection-facing subset of core's EffectiveOperation. */
export interface OperationMeta {
  input?: SchemaView;
  output?: SchemaView;
  /** Canonical kind from core's EffectiveOperation. */
  kind: 'query' | 'command';
  signature?: ParsedSignature;
  /** The façade's effective answer to where every parameter comes from. */
  binding?: OperationBinding[];
  /**
   * The operation in words. It reaches here through core's EffectiveOperation table;
   * this narrowed view simply carries it to the GraphQL field.
   */
  description?: string;
}
