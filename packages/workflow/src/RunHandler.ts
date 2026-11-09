import { release, type Releasing } from '@fougere/core';
import RunRepository from './RunRepository.js';

/** Finish what a stopped process started. */
export default class RunHandler {
  constructor(private runs: RunRepository, private releasing: Releasing) {}

  /**
   * Redo every release whose driver stopped saying it was alive.
   *
   * An operation, so the CLI, an HTTP route and a cron all reach it the same way — a durable
   * engine ships one host adapter per platform to get this far.
   */
  async sweep(): Promise<{ resumed: string[]; failed: string[] }> {
    const resumed: string[] = [];
    const failed: string[] = [];
    for (const run of await this.runs.abandoned()) {
      try {
        await release(run.entity, run.key, this.releasing, [],
          async () => this.releasing.rowsOf(run.entity)?.delete(run.key));
        resumed.push(run.id);
      } catch {
        failed.push(run.id);
      }
    }

    return { resumed, failed };
  }
}
