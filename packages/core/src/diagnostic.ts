/**
 * One thing that does not hold, in the terms of whoever has to fix it — raised by the scan,
 * by a boot rule, or by `fougere check`, which is why it belongs to no phase.
 */
export interface Diagnostic {
  /**
   * `blocking` — the app now serves less than its source declares, and no caller can know it: a
   * handler that failed to parse contributes zero operations.
   */
  severity: 'blocking' | 'warning';
  /** Stable rule name — `handler-parse-failed`, `directory-unreadable`. */
  code: string;
  /** Where to go and look. */
  filePath: string;
  /** The frond it belongs to, when whoever raised it got far enough to know. */
  frond?: string;
  /**
   * What the diagnostic is ABOUT — `PostHandler.publish` — when the rule holds it as a fact
   * rather than inside its sentence. Two ops of one handler breaking the same rule read as
   * one repeated line without it.
   */
  subject?: string;
  /** What does not hold, and what it costs. One sentence, for a human. */
  message: string;
  /** The underlying failure, kept whole. */
  cause?: unknown;
}
