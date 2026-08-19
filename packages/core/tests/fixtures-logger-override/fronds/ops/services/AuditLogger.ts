import { Logger } from '@fougere/core';

/** A framework builtin is a port like any other: extending it takes over its key. */
export default class AuditLogger extends Logger {
  readonly seen: string[] = [];

  info(msg: string) {
    this.seen.push(msg);
  }
}
