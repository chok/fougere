import { Logger } from '@fougere/core';

export default class RedactingLogger extends Logger {
  static readonly SECRET = /(token|password|secret)=\S+/gi;

  constructor(inner: Logger) {
    super(inner);
  }

  /** The one method it changes: what it leaves out runs Logger's code on the real logger's line. */
  info(message: string, ...args: unknown[]) { super.info(this.redact(message), ...args); }

  private redact(message: string): string {
    return message.replace(RedactingLogger.SECRET, '$1=***');
  }
}
