import type { Resolver } from '../../axis/Resolver.js';

/** How a card writes what an axis declared, and reads it back — stated by the card, not the axis. */
export interface CardForm<Declared = unknown, Wire = unknown> {
  describe(value: Declared, key: string): Wire | undefined;

  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}
