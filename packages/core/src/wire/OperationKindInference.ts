import type { OperationKind } from './OperationKind.js';

/** The convention's evidence, including both sides when a composed name contradicts itself. */
export interface OperationKindInference {
  kind?: OperationKind;
  queryMatches: string[];
  commandMatches: string[];
}
