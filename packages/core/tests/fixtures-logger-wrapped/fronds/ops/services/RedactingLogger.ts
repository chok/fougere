import { Logger } from '@fougere/core';

export default class RedactingLogger extends Logger {
  static readonly SECRET = /(token|password|secret)=\S+/gi;

  constructor(private inner: Logger) {
    super();
  }

  debug(message: string, ...args: unknown[]) { this.inner.debug(this.redact(message), ...args); }
  info(message: string, ...args: unknown[])  { this.inner.info(this.redact(message), ...args); }
  warn(message: string, ...args: unknown[])  { this.inner.warn(this.redact(message), ...args); }
  error(message: string, ...args: unknown[]) { this.inner.error(this.redact(message), ...args); }

  private redact(message: string): string {
    return message.replace(RedactingLogger.SECRET, '$1=***');
  }
}
