import type { SchemaView } from '@fougere/schema';
import type { EntityEntry, FrondDescriptor } from './frond.js';

/** What this app hosts, with the questions everyone was asking it by hand. */
export class Fronds extends Array<FrondDescriptor> {
  static override get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  /** The fronds an app hosts, scanned or stated. The only gate in — `Array.of` is taken. */
  static hosting(fronds: readonly FrondDescriptor[]): Fronds {
    const all = new Fronds();
    all.push(...fronds);
    return all;
  }

  /** The frond that hosts an entity — `undefined` when no loaded frond does. */
  owner(entity: string): FrondDescriptor | undefined {
    return this.find((frond) => frond.entities.some((e) => e.name === entity));
  }

  /** The entity of that name, wherever it was declared. */
  entity(name: string): EntityEntry | undefined {
    for (const frond of this) {
      const found = frond.entities.find((e) => e.name === name);
      if (found) return found;
    }
    return undefined;
  }

  /** Every entity class, by name — across all fronds and never per-frond. */
  schemas(): Map<string, SchemaView> {
    return new Map(this.flatMap((frond) => frond.entities.map((e) => [e.name, e.entityClass] as const)));
  }

  /** Every declared entity, sorted. What is DECLARED, not what answers. */
  entityNames(): string[] {
    return this.flatMap((frond) => frond.entities.map((e) => e.name)).sort();
  }

  /** The names a call may address, sorted — what a NOT_FOUND must print. */
  servedNames(surface?: string): string[] {
    return this.flatMap((frond) => frond.handlers
      .filter((handler) => (handler.surface ?? undefined) === surface)
      .map((handler) => handler.address)).sort();
  }
}
