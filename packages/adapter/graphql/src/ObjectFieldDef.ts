import type { ScalarName } from './ScalarName.js';
/** Declarative field definition for registerObjectType. */
export interface ObjectFieldDef {
  /** Scalar name ('string', 'int', 'float', 'boolean') or Pothos type ref. Use [ref] for lists. */
  type: ScalarName | any;
  nullable?: boolean;
  /** Custom resolver. Defaults to `(parent) => parent[fieldName]`. */
  resolve?: (parent: any) => any;
}
