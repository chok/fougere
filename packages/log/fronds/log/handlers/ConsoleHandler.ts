import { formatted, type Fact, type LogLine } from '@fougere/core';

/**
 * The destination every process has until it says otherwise. It is a handler, so it is
 * declared away by not declaring it — and a second destination is a second handler, not
 * a registration call.
 *
 * It announces NOTHING: a destination that logs is a ring, which the emission refuses by
 * name where `onLog`'s sinks used to swallow it.
 */
export default class ConsoleHandler {
  /** Write one line where the operator is looking. */
  async record(line: Fact<LogLine>): Promise<void> {
    const { method, text } = formatted(line);
    console[method](...text);
  }
}
