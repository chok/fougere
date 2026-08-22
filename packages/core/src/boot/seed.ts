import { Role } from '@fougere/schema';
import { facadeKeyOf } from '../wire/call.js';
import type { FrondDescriptor, SeedEntry, SeedFactory } from '../scan/frond.js';
import type { App } from './types.js';
import type { Extension } from './Lifecycle.js';

/**
 * Seeds in dependency order — a `ref()` target is planted before its referrer.
 *
 * The order is a fact about the entity graph, not about the surface running the seeds,
 * so it is stated once here. The Nuxt module read it off a pairwise comparator (which
 * `Array.sort` cannot make transitive: `a` before `b` and `b` before `c` never implies
 * `a` before `c`), and `boot()` had no order at all — the same fact, told twice and
 * wrong both times. A list seeded before its owner failed on the foreign key, and the
 * driver's error named neither the entity nor the file.
 *
 * Kahn, like `orderTables` in `@fougere/adapter-sql` — the same shape one level up: there
 * the nodes are tables and the edges FK columns, here they are seeds and the edges the
 * `one` relations of the entities they target. A cycle cannot be satisfied by ordering,
 * so its remaining seeds keep their scan order and land last: the driver refuses what is
 * genuinely impossible, and everything acyclic around it still gets planted.
 */
export function orderSeeds(fronds: FrondDescriptor[]): SeedEntry[] {
  const refs = new Map<string, Set<string>>();
  for (const frond of fronds) {
    for (const entity of frond.entities) {
      const targets = new Set<string>();
      for (const field of Object.values(entity.entityClass.getFields())) {
        if (!Role.of(field).isReference) continue;
        const target = (Role.of(field).target as { name?: string }).name?.toLowerCase();
        if (target && target !== entity.name.toLowerCase()) targets.add(target);
      }
      refs.set(entity.name.toLowerCase(), targets);
    }
  }

  const seeds = fronds.flatMap((frond) => frond.seeds);
  const seeded = new Set(seeds.map((seed) => seed.entityName.toLowerCase()));

  // Only what is actually seeded can be waited for: a relation to an entity with no seed
  // is already satisfied by whatever put its rows there.
  const waiting = new Map(
    seeds.map((seed) => {
      const own = seed.entityName.toLowerCase();
      const targets = [...(refs.get(own) ?? [])].filter((target) => seeded.has(target) && target !== own);

      return [seed, new Set(targets)] as const;
    }),
  );

  const ordered: SeedEntry[] = [];
  const planted = new Set<string>();

  while (waiting.size > 0) {
    const ready = [...waiting.keys()].find((seed) => [...waiting.get(seed)!].every((dep) => planted.has(dep)));
    if (!ready) break;

    ordered.push(ready);
    planted.add(ready.entityName.toLowerCase());
    waiting.delete(ready);
  }

  return [...ordered, ...waiting.keys()];
}

/** Where a seed writes, and what it may skip — resolved per entity. */
interface SeedDoor {
  list(): Promise<unknown[]>;
  write(item: unknown): Promise<unknown>;
}

/**
 * Plant a set of seeds, in the order given. Reports what it did, one line per entity.
 *
 * The one seeding loop. `boot()` had one and the Nuxt module generated a second into its
 * Nitro plugin, which had drifted: no ORM fallback, so an entity with no façade was
 * skipped there and planted here. Two answers to "how does a row get in at boot" is one
 * too many, and the second was the one running in the browser.
 */
export async function runSeeds(
  app: App,
  seeds: SeedEntry[],
  report: (message: string) => void = () => {},
): Promise<void> {
  for (const seed of seeds) {
    const resolve = <T>(name: string) => app.resolve<T>(name + 'Handler');
    const data = typeof seed.data === 'function' ? await (seed.data as SeedFactory)(resolve) : seed.data;

    const door = doorFor(app, seed.entityName);
    if (!door) {
      report(`  ${seed.entityName}: no handler façade nor ORM — skipping seed`);
      continue;
    }

    const existing = await door.list();
    if (existing.length > 0) {
      report(`  ${seed.entityName}: skipped (${existing.length} exist)`);
      continue;
    }

    // The driver's error alone names neither the entity nor the row — and a foreign
    // key is exactly what a seed gets wrong.
    for (const item of data) {
      try {
        await door.write(item);
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
 * A seed is not a client: it writes at boot, from inside. The façade is used when the
 * entity declares one (its judge catches a bad seed early), the storage when it does
 * not — an entity that exposes nothing is still an entity whose reference rows must land.
 */
function doorFor(app: App, entityName: string): SeedDoor | undefined {
  let handler: Record<string, Function> | undefined;
  try { handler = app.resolve<Record<string, Function>>(facadeKeyOf(entityName)); } catch {}

  if (typeof handler?.list === 'function' && typeof handler.create === 'function') {
    return {
      list: () => handler!.list() as Promise<unknown[]>,
      write: (item) => handler!.create({ params: {}, query: {}, body: item, state: {} }),
    };
  }

  const orm = app.ormFor(entityName) as
    | { list: () => Promise<unknown[]>; create: (input: unknown) => Promise<unknown> }
    | undefined;
  if (!orm) return undefined;

  return { list: () => orm.list(), write: (item) => orm.create(item) };
}

/**
 * The framework's own ascent for rows, named — so a host can REPLACE it rather than take
 * over the whole post-boot to get its own.
 *
 * That is what Nuxt's Nitro plugin had to do: a bundler needs its seed modules spelled out
 * as static imports, so the plugin claimed everything after the boot and its copy of the
 * loop drifted. It now declares an extension under this same name instead, and the delta
 * is one member of a list.
 */
export function seeding(report?: (message: string) => void): Extension {
  return {
    name: 'seeds',
    up: async (app: App) => {
      const seeds = orderSeeds(app.fronds);
      if (seeds.length > 0) await runSeeds(app, seeds, report);
    },
  };
}
