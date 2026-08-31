import type { Fronds } from '../descriptor/Fronds.js';

/** Result of scanning a project directory. */
/**
 * Something the scan could NOT do — recorded instead of swallowed.
 *
 * The scan answers with what it found. Until now it answered the same way whether
 * a directory held nothing or could not be read, and whether a handler declared no
 * operation or failed to parse: `catch → empty`. So every downstream reader — the
 * façade, the identity card, anything asking "what does this app serve?" — could
 * not tell **"there is nothing"** from **"I could not look"**.
 *
 * That distinction is what makes a rule about an ABSENCE sound. Without it, a check
 * derived from the scan reports "nothing wrong" precisely when it read nothing.
 */
export interface ScanDiagnostic {
  /**
   * `blocking` — the app now serves less than its source declares, and no caller
   * can know it: a handler that failed to parse contributes zero operations.
   * `warning` — something may be missing and the scan cannot decide, e.g. a base
   * class it is not allowed to resolve. Statable in `frond.config.ts`.
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
