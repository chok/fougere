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

/**
 * Every blocking diagnostic in ONE refusal, so a boot names all of them rather than the
 * first — the shape `fougere check` renders, read back by whoever has to fix it.
 */
export function refusalOf(diagnostics: readonly Diagnostic[], what: string): Error | undefined {
  const blocking = diagnostics.filter((one) => one.severity === 'blocking');
  if (blocking.length === 0) return undefined;

  const lines = blocking.map((one) =>
    `  [${one.code}]${one.subject ? ` ${one.subject}` : ''}\n    ${one.message}\n    ${one.filePath}`);

  return new Error(`Fougere boot refused: ${blocking.length} ${what}:\n${lines.join('\n')}`);
}
