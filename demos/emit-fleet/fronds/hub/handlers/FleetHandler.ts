import type { Emit, Fact } from '@fougere/core';
import type Recalibrate from '@frond/fleet/entities/Recalibrate.js';
import type Reading from '@frond/fleet/entities/Reading.js';

/**
 * The hub — it announces downward and listens upward, in one class.
 *
 * Nothing here names a device. `Emit` names a subject; how many machines are plugged in is
 * not this file's business, and a sixth one does not reopen it.
 */
export default class FleetHandler {
  constructor(private recalibration: Emit<Recalibrate>) {}

  /** Tell the fleet — or one of it — to recalibrate. */
  async recalibrate(offset: number, node?: string): Promise<{ sent: true }> {
    await this.recalibration({ offset, node, at: new Date() });
    return { sent: true };
  }

  /** A measurement came up from a device. */
  async record(fact: Fact<Reading>): Promise<void> {
    console.log(`\x1b[32m  [hub]\x1b[0m ${fact.node} → ${fact.celsius}°C`);
  }
}
