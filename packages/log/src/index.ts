/**
 * Where a log line GOES. The line itself is core's — the boot announces one before any
 * frond exists, so naming it there would cost core an optional package's vocabulary.
 *
 * STATED and not scanned: `frond()` is what a published package hands over, so a consumer
 * needs no TypeScript loader and no scan of its `node_modules`. The contract is written
 * here for the same reason — nobody reads this handler's source at boot.
 */
import { frond, LogLine } from '@fougere/core';
import ConsoleHandler from '../fronds/log/handlers/ConsoleHandler.js';

export { default as ConsoleHandler } from '../fronds/log/handlers/ConsoleHandler.js';

/**
 * What an app takes on to have its lines written. Leave it out and nothing writes them —
 * which is the whole difference from a logger you have to turn off.
 */
export const logFrond = () => frond('log', {
  entities: [LogLine],
  handlers: [{
    ctor: ConsoleHandler,
    operations: {
      record: {
        input: LogLine,
        binding: [{ name: 'line', optional: false, source: { kind: 'fact', factName: 'logLine' } }],
      },
    },
  }],
});
