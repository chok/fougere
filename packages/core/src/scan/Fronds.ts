import type { SchemaView } from '@fougere/schema';
import type { EntityEntry, FrondDescriptor } from './frond.js';

/**
 * What this app hosts — the scan's answer, with the questions everyone was asking it
 * by hand.
 *
 * The list was a bare array, so every reader re-walked it: "which frond owns this
 * entity" was spelled four times, "every entity by name" three times as three literal
 * copies of the same `Map`, and the two inside the boot even carried comments saying so.
 * A concept nobody can question is a concept everyone rebuilds.
 *
 * It IS an array — the same reason `ListResult` is one: twenty call sites iterate,
 * filter and spread it, and none of them is wrong to. `Symbol.species` is `Array` so a
 * `.map()` over it answers a plain array rather than something that claims to be a
 * hosting table and holds strings.
 */
export class Fronds extends Array<FrondDescriptor> {
  static override get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  /** What one scan run found. The only gate in — `Array.of` is taken, and named. */
  static scanned(fronds: readonly FrondDescriptor[]): Fronds {
    const held = new Fronds();
    held.push(...fronds);
    return held;
  }

  /** The frond that hosts an entity — `undefined` when no loaded frond does. */
  owner(entity: string): FrondDescriptor | undefined {
    return this.find((frond) => frond.entities.some((e) => e.name === entity));
  }

  /** The entity of that name, wherever it was scanned. */
  entity(name: string): EntityEntry | undefined {
    for (const frond of this) {
      const found = frond.entities.find((e) => e.name === name);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Every scanned entity class, by name — across all fronds and never per-frond.
   *
   * A fact is announced in one frond and heard in another, so the subscriber's own
   * frond does not hold the shape it must judge; a `reads:` clause names entities
   * that belong to neighbours by definition.
   */
  schemas(): Map<string, SchemaView> {
    return new Map(this.flatMap((frond) => frond.entities.map((e) => [e.name, e.entityClass] as const)));
  }

  /** What is hosted here, sorted — the sentence a NOT_FOUND prints. */
  entityNames(): string[] {
    return this.flatMap((frond) => frond.entities.map((e) => e.name)).sort();
  }
}
