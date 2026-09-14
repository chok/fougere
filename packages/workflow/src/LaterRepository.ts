import { Call, Repository, RouteAddress, type Storage } from '@fougere/core';
import Later from './Later.js';

/** How long a taker holds a due call before anyone may take it over. */
const TAKE_MS = 30_000;

/**
 * The calls waiting for their hour, and the take that says one process is making them.
 *
 * The take is bounded like `RunRepository`'s lease and for the same reason, but it guards the
 * opposite case: a release may be redone, a call may not, so what is bounded here is how long
 * a taker is believed rather than how long a driver is assumed alive.
 */
export default class LaterRepository extends Repository(Later) {
  constructor(storage: Storage<Later>, private now: () => number = Date.now) {
    super(storage);
  }

  async keep(call: Call, runAt: number): Promise<void> {
    const { runAt: _dropped, ...invocation } = call.invocation;
    await this.create({
      id: crypto.randomUUID(),
      entity: call.address.entity,
      operation: call.address.operation,
      invocation,
      runAt,
    });
  }

  /**
   * The calls whose hour has passed and whom nobody is making right now.
   *
   * Read whole and filtered here, which bounds what this package holds: a source that answers
   * `where` on two numbers would answer it at the rows, and that is the next thing to ask for.
   */
  async due(): Promise<Later[]> {
    const rows = await this.list();
    const now = this.now();

    return rows.filter((row) => row.runAt <= now && (row.takenUntil ?? 0) <= now);
  }

  /** Hold this one, or say another process already has it — the read and the write are two. */
  async take(id: string): Promise<'taken' | 'busy'> {
    const held = await this.findById(id);
    if (!held) return 'busy';
    if ((held.takenUntil ?? 0) > this.now()) return 'busy';

    await this.update(id, { takenUntil: this.now() + TAKE_MS });

    return 'taken';
  }

  async done(id: string): Promise<void> {
    await this.delete(id);
  }

  /** Rebuilds what was kept — the address flat, the invocation whole. */
  callOf(row: Later): Call {
    return new Call(
      new RouteAddress({ entity: row.entity, operation: row.operation }),
      row.invocation as Record<string, unknown>,
    );
  }
}
