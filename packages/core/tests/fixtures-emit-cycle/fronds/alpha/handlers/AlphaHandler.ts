import { entity, primary } from '@fougere/schema';
import type { Emit, Fact } from '@fougere/core';

/** Declared here rather than in `entities/`: a fact needs no table to be announced. */
export class Beta extends entity({ id: primary() }) {}
export class Alpha extends entity({ id: primary() }) {}

/** Hears alpha, announces beta. */
export default class AlphaHandler {
  constructor(private beta: Emit<Beta>) {}

  /** React to alpha by announcing beta. */
  async onAlpha(fact: Fact<Alpha>): Promise<void> {
    await this.beta({ id: fact.id });
  }
}
