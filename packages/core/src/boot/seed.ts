import { Role } from '@fougere/schema';
import { facadeKeyOf } from '../wire/call.js';
import type { FrondDescriptor, SeedEntry, SeedFactory } from '../descriptor/frond.js';
import type { App } from './types.js';
import type { Extension } from './AppLifecycle.js';

/** Seeds in dependency order — a `ref()` target is planted before its referrer. */
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

/** Plant a set of seeds, in the order given. */
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
      report(`  ${seed.entityName}: no handler façade nor storage — skipping seed`);
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

/** A seed is not a client. */
function doorFor(app: App, entityName: string): SeedDoor | undefined {
  let handler: Record<string, Function> | undefined;
  try { handler = app.resolve<Record<string, Function>>(facadeKeyOf(entityName)); } catch {}

  if (typeof handler?.list === 'function' && typeof handler.create === 'function') {
    return {
      list: () => handler!.list() as Promise<unknown[]>,
      write: (item) => handler!.create({ params: {}, query: {}, body: item, state: {} }),
    };
  }

  const storage = app.storageFor(entityName) as
    | { list: () => Promise<unknown[]>; create: (input: unknown) => Promise<unknown> }
    | undefined;
  if (!storage) return undefined;

  return { list: () => storage.list(), write: (item) => storage.create(item) };
}

/**
 * The framework's own ascent for rows, named — so a host can REPLACE it rather than take over the
 * whole post-boot to get its own.
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
