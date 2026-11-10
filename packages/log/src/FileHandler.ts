import { appendFile } from 'node:fs/promises';
import type { Fact, LogLine } from '@fougere/core';

/** Where the lines land, and the only thing this destination is configured with. */
export class LogFile {
  constructor(readonly path: string) {}
}

/** One JSON object per line, appended to a file — the shape a collector tails. */
export default class FileHandler {
  constructor(private file: LogFile) {}

  /** Append one line. */
  async record(line: Fact<LogLine>): Promise<void> {
    await appendFile(this.file.path, `${JSON.stringify(line)}\n`, 'utf8');
  }
}
