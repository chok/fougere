import type { Ctor } from '../Ctor.js';

/** A class the boot builds — what its constructor asks for, and where the scan found it. */
export interface Subject {
  ctor: Ctor;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}
