import type { Fronds } from '../descriptor/Fronds.js';

/** Result of scanning a project directory. */
/** Something the scan could NOT do — recorded instead of swallowed. */
export interface ScanDiagnostic {
  /**
   * `blocking` — the app now serves less than its source declares, and no caller can know it: a
   * handler that failed to parse contributes zero operations.
   */
  severity: 'blocking' | 'warning';
  /** Stable rule name — `handler-parse-failed`, `directory-unreadable`. */
  code: string;
  /** Absolute path of what could not be read. */
  filePath: string;
  /** The frond it belongs to, when the scan got far enough to know. */
  frond?: string;
  /** The declaration the diagnostic is about — e.g. `PostHandler.publish`. */
  subject?: string;
  /** What could not be done, and what it costs. One sentence, for a human. */
  message: string;
  /** The underlying failure, kept whole. */
  cause?: unknown;
}

export interface ScanResult {
  fronds: Fronds;
  /** What the scan could not do. Empty is a claim, not a default — see {@link ScanDiagnostic}. */
  diagnostics: ScanDiagnostic[];
}
