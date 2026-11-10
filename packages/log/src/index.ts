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

/** The name `fronds: { '@fougere/log': {} }` reaches: the last segment of the specifier. */
export const log = (path?: string): Extension => ({
  name: 'log',
  ...(path ? { fronds: [logFrond(path)] } : {}),
  up(app) {
    app.use(callLines(app.container.resolve<Logger>('Logger')));
  },
});
