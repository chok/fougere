import type { Fronds } from './descriptor/Fronds.js';
import type { Diagnostic } from './diagnostic.js';

/** Result of scanning a project directory. */
export interface ScanResult {
  fronds: Fronds;
  /** What the scan could not do. Empty is a claim, not a default — see {@link Diagnostic}. */
  diagnostics: Diagnostic[];
}
