import { frond, LogLine, type Extension, type Logger } from '@fougere/core';
import FileHandler, { LogFile } from './FileHandler.js';
import { callLines } from './CallLines.js';

export { default as FileHandler, LogFile } from './FileHandler.js';
export { callLines } from './CallLines.js';

/** Lines to a file, one JSON object each. */
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

/**
 * The two lines every call writes, through the process's logger.
 * Ex: `platform: [log()]`.
 */
export const log = (): Extension => ({
  name: 'log',
  up(app) {
    app.use(callLines(app.container.resolve<Logger>('Logger')));
  },
});

/**
 * A file every line of the process goes to, one JSON object each — the call lines among them when `log()` is carried too.
 * Ex: `platform: [log(), file('./lines.jsonl')]`.
 */
export const file = (path: string): Extension => ({
  name: 'file',
  fronds: [logFrond(path)],
});
