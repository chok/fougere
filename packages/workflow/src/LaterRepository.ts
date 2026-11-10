import { Call, Repository, RouteAddress } from '@fougere/core';
import Later from './Later.js';

const TAKE_MS = 30_000;

/** The calls waiting for their hour, and the take that says one process is making them. */
export default class LaterRepository extends Repository<Later> {
  constructor(private now: () => number = Date.now) {
    super();
  }

  async keep(call: Call, runAt: number): Promise<void> {
    const { runAt: _dropped, ...invocation } = call.invocation;
    await this.create({
      id: crypto.randomUUID(),
      address: call.address.address,
      operation: call.address.operation,
      invocation,
      runAt,
    });
  }

  /** The calls whose hour has passed and whom nobody is making right now. */
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
      new RouteAddress({ address: row.address, operation: row.operation }),
      row.invocation as Record<string, unknown>,
    );
  }
}
