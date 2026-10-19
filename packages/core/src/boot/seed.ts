import { Page } from '../wire/Page.js';
import { Graph } from '@fougere/graph';
import { relationGraph } from '../module/relation/relationGraph.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { SeedEntry } from '../descriptor/SeedEntry.js';
import type { SeedFactory } from '../descriptor/SeedFactory.js';
import type { App } from './App.js';
import type { Extension } from './Extension.js';

/** What the ordering satisfied, and what no order can. */
export interface SeedOrder {
  ordered: SeedEntry[];
  /** Seeds whose `ref()` targets wait on each other — no order plants them all. */
  cycle: SeedEntry[];
}

/**
 * Seeds in dependency order — a `ref()` target is planted before its referrer. Only what is SEEDED
 * can be waited for: a relation to an entity with no seed is already satisfied by whatever put its
 * rows there, and an entity naming itself waits for nobody.
 */
export function orderSeeds(fronds: FrondDescriptor[]): SeedOrder {
  const seeded = new Map<string, SeedEntry[]>();
  for (const seed of fronds.flatMap((frond) => frond.seeds)) {
    seeded.set(seed.entityName, [...seeded.get(seed.entityName) ?? [], seed]);
  }

  const relations = relationGraph(fronds);
  const waiting = new Graph();
  for (const entity of seeded.keys()) waiting.add(entity);
  for (const entity of seeded.keys()) {
    for (const { to, label } of relations.outgoing(entity)) {
      if (seeded.has(to)) waiting.connect(entity, to, label);
    }
  }

  const { ordered, cycle } = waiting.order();
  const seedsOf = (entities: string[]) => entities.flatMap((entity) => seeded.get(entity)!);

  return { ordered: seedsOf(ordered), cycle: seedsOf(cycle) };
}

/**
 * Plant a set of seeds, in the order given — by the storage, as a handler writes: a seed is the
 * frond's own code, not a client.
 *
 * Documented: [seeds](https://fougere.dev/docs/business/seeds).
 */
export async function runSeeds(
  app: App,
  seeds: SeedEntry[],
  report: (message: string) => void = () => {},
): Promise<void> {
  for (const seed of seeds) {
    const storage = app.storageFor(seed.entityName);
    if (!storage) {
      report(`  ${seed.entityName}: no storage in this process — skipping seed`);
      continue;
    }

    const existing = Page.of(await storage.list()).items;
    if (existing.length > 0) {
      report(`  ${seed.entityName}: skipped (${existing.length} exist)`);
      continue;
    }

    const resolve = <T>(name: string) => app.resolve<T>(name + 'Handler');
    const data = typeof seed.data === 'function' ? await (seed.data as SeedFactory)(resolve) : seed.data;

    // The driver's error alone names neither the entity nor the row — and a foreign
    // key is exactly what a seed gets wrong.
    for (const item of data) {
      try {
        await storage.create(item);
      } catch (cause) {
        throw new Error(
          `Seed '${seed.entityName}' failed on ${JSON.stringify(item)}: ${(cause as Error)?.message ?? cause}`,
          { cause },
        );
      }
    }
    report(`  ${seed.entityName}: ${data.length} records`);
  }
}

/**
 * The framework's own ascent for rows, named — so a host can REPLACE it rather than take over the
 * whole post-boot to get its own.
 */
export function seeding(report?: (message: string) => void): Extension {
  return {
    name: 'seeds',
    up: async (app: App) => {
      const { ordered, cycle } = orderSeeds(app.fronds);
      if (cycle.length > 0) {
        report?.(
          `  ${cycle.map((seed) => seed.entityName).join(', ')}: a ref() cycle, and no order `
          + 'plants them all — planted in the order they are declared, and the source answers for the rest',
        );
      }

      const seeds = [...ordered, ...cycle];
      if (seeds.length > 0) await runSeeds(app, seeds, report);
    },
  };
}
