import type { Emit, Fact } from '@fougere/core';
import type Reading from '../../fleet/entities/Reading.js';
import type Recalibrate from '../../fleet/entities/Recalibrate.js';

/**
 * A device. It announces its readings and listens for orders, and it names no hub.
 *
 * Same shape as the hub's handler: both announce, both listen. Which end is "central" is a
 * fact of deployment, not of code.
 */
export default class SensorHandler {
  private offset = 0;

  constructor(private reading: Emit<Reading>) {}

  /** Take a measurement and announce it. */
  async report(node: string): Promise<void> {
    const celsius = Math.round((18 + Math.random() * 4 + this.offset) * 10) / 10;
    await this.reading({ node, celsius, at: new Date() });
  }

  /** Apply a recalibration — if it is for us. The filter is data, not addressing. */
  async apply(fact: Fact<Recalibrate>): Promise<void> {
    const me = process.env.NODE_ID ?? 'sensor-?';
    if (fact.node && fact.node !== me) {
      console.log(`\x1b[2m  [${me}] recalibration for ${fact.node} — not mine\x1b[0m`);
      return;
    }
    this.offset = fact.offset;
    console.log(`\x1b[36m  [${me}]\x1b[0m recalibrated, offset ${fact.offset > 0 ? '+' : ''}${fact.offset}`);
  }
}
