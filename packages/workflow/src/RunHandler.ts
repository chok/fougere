import { release, type Releasing } from '@fougere/core';
import RunRepository from './RunRepository.js';
import { DRIVER } from './RunJournal.js';

/** Finish what a stopped process started. */
export default class RunHandler {
  constructor(private runs: RunRepository, private releasing: Releasing) {}

  /**
   * Redo every release whose driver stopped saying it was alive.
   *
   * An operation, so the CLI, an HTTP route and a cron all reach it the same way — a durable
   * engine ships one host adapter per platform to get this far.
   */
  async sweep(): Promise<{ resumed: string[] }> {
    const resumed: string[] = [];
    for (const run of await this.runs.abandoned()) {
      if (await this.runs.open(run.entity, run.key, DRIVER) === 'busy') continue;
      // The row too: a release interrupted before it reached the row is not finished.
      await release(run.entity, run.key, this.releasing, [],
        async () => this.releasing.rowsOf(run.entity)?.delete(run.key));
      await this.runs.close(run.entity, run.key);
      resumed.push(run.id);
    }

    return { resumed };
  }
}
