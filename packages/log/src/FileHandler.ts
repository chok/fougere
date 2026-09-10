import { appendFile } from 'node:fs/promises';
import type { Fact, LogLine } from '@fougere/core';

/** Where the lines land, and the only thing this destination is configured with. */
export class LogFile {
  constructor(readonly path: string) {}
}

/**
 * One JSON object per line, appended to a file — the shape a collector tails.
 *
 * A destination sends a line ELSEWHERE: the console is core's, written whoever else took
 * the line, so a handler that printed would say everything twice.
 *
 * It announces NOTHING. A destination that logs is a ring, and the emission refuses it by
 * name where `onLog`'s try/catch used to swallow it.
 *
 * In `src/` and not under a `fronds/` directory: that name is what a SCAN reads, and this
 * frond is stated, because a published package is read by no scanner.
 */
export default class FileHandler {
  constructor(private file: LogFile) {}

  /** Append one line. */
  async record(line: Fact<LogLine>): Promise<void> {
    await appendFile(this.file.path, `${JSON.stringify(line)}\n`, 'utf8');
  }
}
