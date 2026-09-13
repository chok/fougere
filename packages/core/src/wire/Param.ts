import type { TypeRef } from './TypeRef.js';

/** One parameter of a signature. */
export interface Param {
  name: string;
  type: TypeRef;
  optional?: boolean;
}
