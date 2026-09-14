import { Repository, type Storage } from '@fougere/core';
import Run from './Run.js';

/** How long a driver holds a run before anyone may take it over. */
const LEASE_MS = 30_000;

/**
 * The runs, and the lease that says one process is driving.
 *
 * A lease is time-bounded on purpose: no process can tell whether another is dead or slow, so
 * the question is never asked. What is bounded instead is how long an answer is assumed, and
 * two drivers at once stay harmless because every hop can be done twice.
 */
export default class RunRepository extends Repository(Run) {
  constructor(storage: Storage<Run>, private now: () => number = Date.now) {
    super(storage);
  }

  /** Take this release on, or say it is already someone's — the same row either way. */
  async open(entity: string, key: string, owner: string): Promise<'taken' | 'busy'> {
    const id = `${entity}:${String(key)}`;
    const held = await this.findById(id);
    const until = this.now() + LEASE_MS;

    if (!held) {
      await this.create({ id, entity, key: String(key), status: 'running', leaseOwner: owner, leaseUntil: until });

      return 'taken';
    }
    if (held.status === 'running' && held.leaseUntil > this.now() && held.leaseOwner !== owner) return 'busy';

    await this.update(id, { status: 'running', leaseOwner: owner, leaseUntil: until, finishedAt: null });

    return 'taken';
  }

  async close(entity: string, key: string): Promise<void> {
    await this.update(`${entity}:${String(key)}`, { status: 'done', finishedAt: this.now() });
  }

  /** Runs whose driver stopped saying it was alive — what a sweep has to finish. */
  async abandoned(): Promise<Run[]> {
    const running = await this.findAllBy({ status: 'running' });

    return running.filter((run) => run.leaseUntil <= this.now());
  }
}
