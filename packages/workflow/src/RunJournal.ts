import { JOURNAL, type Call, type Journal } from '@fougere/core';
import LaterRepository from './LaterRepository.js';
import RunRepository from './RunRepository.js';

export { JOURNAL };

/**
 * The journal core asks for, answered by a row.
 *
 * Registered under core's own key, which is how an optional package answers a reading core
 * declares — the same shape a source takes when it says what it keeps at the rows.
 */
export default class RunJournal implements Journal {
  constructor(private runs: RunRepository, private later: LaterRepository) {}

  keep(call: Call, runAt: number): Promise<void> {
    return this.later.keep(call, runAt);
  }

  open(entity: string, key: string): Promise<'taken' | 'busy'> {
    return this.runs.open(entity, key, DRIVER);
  }

  close(entity: string, key: string): Promise<void> {
    return this.runs.close(entity, key);
  }
}

/** What this process calls itself while it drives a run — enough to tell it from another. */
export const DRIVER = `${process.pid}`;
