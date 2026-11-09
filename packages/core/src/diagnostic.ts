import { BootRefusal } from './BootRefusal.js';

/** One thing that does not hold, in the terms of whoever has to fix it. */
export interface Diagnostic {
  /** `blocking` means the app serves less than its source declares. */
  severity: 'blocking' | 'warning';
  /** Stable rule name — `handler-parse-failed`, `directory-unreadable`. */
  code: string;
  /** Where to go and look. */
  filePath: string;
  /** The frond it belongs to, when whoever raised it got far enough to know. */
  frond?: string;
  /**
   * What the diagnostic is about, when the rule holds it as a fact.
   * Ex: `PostHandler.publish`.
   */
  subject?: string;
  /** What does not hold, and what it costs. One sentence, for a human. */
  message: string;
  /** The underlying failure, kept whole. */
  cause?: unknown;
}

/** Every blocking diagnostic in one refusal. */
export function refusalOf(diagnostics: readonly Diagnostic[], what: string): BootRefusal | undefined {
  const blocking = diagnostics.filter((one) => one.severity === 'blocking');
  if (blocking.length === 0) return undefined;

  const lines = blocking.map((one) =>
    `  [${one.code}]${one.subject ? ` ${one.subject}` : ''}\n    ${one.message}\n    ${one.filePath}`);

  return new BootRefusal(`Fougere boot refused: ${blocking.length} ${what}:\n${lines.join('\n')}`);
}
