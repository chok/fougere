import Run from '../entities/Run.js';

declare class RunRepository {
  list(): Promise<Run[]>;
}

/** Three outputs: one declared, one already data, one that is neither. */
export default class RunHandler {
  constructor(private runs: RunRepository) {}

  /** Every run — a declared entity, whose `created()` field leaves as an ISO string. */
  async list(): Promise<Run[]> {
    return this.runs.list();
  }

  /** How many there are — data, and nothing converts it because nothing has to. */
  async findCount(): Promise<{ count: number; ok: true }> {
    return { count: (await this.runs.list()).length, ok: true };
  }

  /** No return type written — the checker holds one, so the contract does too. */
  async findFirst() {
    return (await this.runs.list())[0];
  }

  /** A `Date` nobody declared: local callers would read a `Date`, remote ones a string. */
  async findLast(): Promise<{ at: Date }> {
    return { at: new Date() };
  }
}
