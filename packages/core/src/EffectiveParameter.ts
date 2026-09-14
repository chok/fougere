import type { Binding } from './Binding.js';
export interface EffectiveParameter {
  /** Position in the TypeScript signature. Never used to infer provenance. */
  position: number;
  name: string;
  type: string | null;
  optional: boolean;
  nullable: boolean;
  /** `?` and `| undefined` both mean canonical absence. */
  undefinable: boolean;
  /** The resolved provenance of this parameter. */
  binding: Binding;
}
