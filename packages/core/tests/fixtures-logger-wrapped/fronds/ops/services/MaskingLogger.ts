import type { Logger } from '@fougere/core';

/** Writes `info` and nothing else: every other method is the logger it stands in front of. */
export default class MaskingLogger implements Partial<Logger> {
  constructor(private inner: Logger) {}

  info(message: string, ...args: unknown[]) {
    this.inner.info(message.replace(/(token|password|secret)=\S+/gi, '$1=***'), ...args);
  }
}
