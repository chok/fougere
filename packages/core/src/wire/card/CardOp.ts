import type { SchemaDescriptor } from '@fougere/schema';
import type { OperationContract } from '../OperationContract.js';
import type { OperationKind } from '../OperationKind.js';

/**
 * One operation, as a stranger meets it — its name, what it is for, what it takes and whether it
 * reads or writes.
 */
export interface CardOp extends Pick<OperationContract, 'description' | 'cardinality' | 'errors'> {
  name: string;
  /** JSON Schema of what it accepts, when the contract names a view. */
  input?: SchemaDescriptor;
  /** JSON Schema of what it emits, when the contract names one. */
  output?: SchemaDescriptor;
  kind: OperationKind;
  /** The fact this op is handed when it is announced — its `Fact<T>`, which IS the subscription. */
  listens?: string;
}
