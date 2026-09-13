import type { TypeRef } from './TypeRef.js';
import type { Param } from './Param.js';

/** A method's signature, as a contract is built from it — the shape, never the reading. */
export interface Signature {
  name: string;
  params: Param[];
  returnType?: TypeRef;
  /** Came from a base class, not from the file being scanned. */
  inherited?: boolean;
  /** The operation in words — the first sentence of the method's doc comment. */
  description?: string;
}
