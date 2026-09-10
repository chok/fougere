/**
 * Where a log line GOES. The line itself is core's — the boot announces one before any
 * frond exists, so naming it there would cost core an optional package's vocabulary, and
 * the console is core's too: it writes every line whoever else took it.
 *
 * So what this package holds is a destination that sends a line SOMEWHERE ELSE. Stated and
 * not scanned: `frond()` is what a published package hands over, so a consumer needs no
 * TypeScript loader and no scan of its `node_modules`. The contract is written here for the
 * same reason — nobody reads this handler's source at boot.
 */
import { frond, LogLine } from '@fougere/core';
import FileHandler, { LogFile } from './FileHandler.js';

export { default as FileHandler, LogFile } from './FileHandler.js';

/**
 * Lines to a file, one JSON object each. Leave it out and they only reach the console —
 * which is the whole difference from a logger you have to turn off.
 *
 * The path is closed over by a subclass rather than registered: a frond states classes, and
 * a value it should be constructed with has no key to answer under.
 */
export const logFrond = (path: string) => {
  class Lines extends FileHandler {
    constructor() {
      super(new LogFile(path));
    }
  }

  return frond('log', {
    entities: [LogLine],
    handlers: [{
      ctor: Lines,
      deps: [],
      operations: {
        record: {
          input: LogLine,
          binding: [{ name: 'line', optional: false, source: { kind: 'fact', factName: 'logLine' } }],
        },
      },
    }],
  });
};
