/**
 * Building a frame — what a handler asking for `Together<[…]>` receives.
 *
 * The declaration names its members and nothing else; where they live, and therefore
 * which of the two realizations they get, is read HERE and stated at boot. A frame whose
 * members share an engine is a transaction; one whose members are split replays its own
 * inverses (`frame.ts`). Same user code, two guarantees, and the boot says which — the
 * one thing a gradient must never leave to assumption.
 */
import { ambient } from '#ambient';
import { upperFirst, lowerFirst, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { membersOfTogetherKey, ormKeyOf, type EntityOrm, type OrmFactory } from '../orm.js';
import type { Logger } from '../builtins/logger.js';
import type { ProviderEntry } from '../scan/frond.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import { recording, unwind, type Undo } from './frame.js';

/** Everything the boot knows that a frame needs, gathered once for every frond. */
export interface FrameWorld {
  /** Every entity of every frond, by registration key. A frame crosses fronds by design. */
  entityByName: Map<string, SchemaView>;
  /** Which frond holds an entity — the question `remotes:` turns into a refusal. */
  frondOf: Map<string, string>;
  hostedHere: (frond: string) => boolean;
  ormFactory?: OrmFactory;
  sourceOf?: (entityName: string) => string;
  transacted?: <R>(source: string, fn: (ormFactory: OrmFactory) => Promise<R>) => Promise<R>;
  log: Logger;
}

/** An entity the block writes through, and a provider rebuilt so that its writes count too. */
interface Members {
  entities: { name: string; schema: SchemaView }[];
  providers: ProviderEntry[];
}

/**
 * Each declared name, resolved to what it designates.
 *
 * A name that resolves to nothing is refused rather than skipped: `Together<[Account,
 * Ledgre]>` is a typo whose only other symptom is a frame quietly one member short. The
 * two lists are checked against different registries, which is exactly why the declaration
 * separates them — nothing here has to guess what kind a name is.
 */
function resolve(names: { entities: string[]; providers: string[] }, declared: readonly ProviderEntry[], world: FrameWorld): Members {
  const entities = names.entities.map((member) => {
    const name = lowerFirst(member);
    const schema = world.entityByName.get(name);
    if (!schema) {
      throw new Error(
        `Together<[…${member}…]>: no entity named '${member}' is scanned in this app. ` +
        `The first list names entities; a class of this frond goes in the second.`,
      );
    }
    return { name, schema };
  });

  const providers = names.providers.map((member) => {
    const entry = declared.find((provider) => provider.ctor.name === member);
    if (!entry) {
      throw new Error(
        `Together<[…], [… ${member} …]>: this frond declares no class named '${member}'. ` +
        `The second list names providers to rebuild inside the frame — a service, a mirror, ` +
        `a repository — so that what they write is covered by the unwind.`,
      );
    }
    return entry;
  });

  return { entities, providers };
}

/**
 * A member that cannot write here at all — its frond is hosted elsewhere.
 *
 * Refused rather than compensated: a compensated frame still writes through a local ORM,
 * and a remote frond registers none. There is nothing to record and nothing to undo.
 */
function refuseRemote(members: Members, world: FrameWorld, key: string): void {
  for (const member of members.entities) {
    const frond = world.frondOf.get(member.name);
    if (frond && !world.hostedHere(frond)) {
      throw new Error(
        `Together<[…]> (${key}): '${member.name}' belongs to frond '${frond}', which this ` +
        `process declares in remotes: — it registers no storage here, so its writes cannot be ` +
        `part of a frame. Host the frond here, or split the work and join the halves with a fact.`,
      );
    }
  }
}

/**
 * A provider member writing an entity the frame does not name.
 *
 * The frame does not widen itself to cover it: doing so would pull an entity from another
 * source into the group without anyone writing it down. Named instead, with the one-word fix.
 */
function refuseUncoveredWrites(members: Members, key: string): void {
  const covered = new Set(members.entities.map((member) => member.name));
  for (const provider of members.providers) {
    for (const dep of provider.deps) {
      if (!dep.endsWith('Orm')) continue;
      const entity = lowerFirst(dep.slice(0, -'Orm'.length));
      if (covered.has(entity)) continue;
      throw new Error(
        `Together<[…]> (${key}): ${provider.ctor.name} writes ${entity}, which is not in the ` +
        `frame's entity list — its writes would escape the unwind. Add it: ` +
        `Together<[…, ${upperFirst(entity)}], [… ${provider.ctor.name} …]>.`,
      );
    }
  }
}

/**
 * Open the block: build every member over `factory`, in a scope of their own.
 *
 * The scope is what makes a provider member work without a locator — its ORM keys are
 * registered here, so the container hands it the framed ones through the ordinary
 * constructor. It is disposed when the block ends, whichever way it ended.
 */
async function inScope<R>(
  parent: Container,
  members: Members,
  factory: OrmFactory,
  wrap: (orm: EntityOrm, name: string, schema: SchemaView) => EntityOrm,
  fn: (entities: unknown[], providers: unknown[]) => Promise<R>,
): Promise<R> {
  const scope = parent.createScope();
  try {
    const orms = members.entities.map((member) => {
      const orm = wrap(factory(member.schema, member.name), member.name, member.schema);
      scope.registerValue(ormKeyOf(member.name), orm);
      return orm;
    });
    // Providers after every ORM is in place: one may depend on another member's.
    const built = members.providers.map((provider) => {
      scope.register(provider.ctor.name, provider.ctor, { deps: provider.deps });
      return scope.resolve(provider.ctor.name);
    });
    return await fn(orms, built);
  } finally {
    await scope.dispose();
  }
}

/**
 * Register one frame per key a handler or provider of this frond asked for.
 *
 * Called with the frond's scope, because that is where the asking constructor resolves —
 * while the MEMBERS are looked up app-wide, a frame crossing fronds being the ordinary case
 * rather than the exception (the frond is not the storage boundary; `sources:` is).
 */
export function registerFrames(
  scope: Container,
  keys: Iterable<string>,
  providers: readonly ProviderEntry[],
  world: FrameWorld,
): void {
  let registered = 0;
  for (const key of new Set(keys)) {
    const names = membersOfTogetherKey(key);
    if (!names) continue;
    registered += 1;
    if (!world.ormFactory) {
      throw new Error(`Together<[${names.entities.join(', ')}]> needs storage, and this boot declares none.`);
    }

    const members = resolve(names, providers, world);
    refuseRemote(members, world, key);
    refuseUncoveredWrites(members, key);

    const sources = new Set(members.entities.map((member) => world.sourceOf?.(member.name) ?? 'db'));
    const judge = (orm: EntityOrm, name: string, schema: SchemaView) =>
      new StorageGuard(schema.getFields(), name).guard(orm);

    // One engine and a way into it: the engine gives the unwind AND the isolation.
    if (world.transacted && sources.size === 1) {
      const source = [...sources][0];
      world.log.info(`${key} — transaction, source '${source}'`);
      scope.registerValue(key, {
        run: <R>(fn: (entities: never, providers: never) => Promise<R>) =>
          ambient.enterFrame(key, () =>
            world.transacted!(source, (factory) => inScope(scope, members, factory, judge, fn as never))),
      });
      continue;
    }

    // Split, or an engine that hands out no transaction: the frame keeps the before-image
    // of every write and replays the inverses itself. `judge` stays OUTSIDE `recording`, so
    // a write the entity refuses never enters the journal.
    const why = sources.size > 1
      ? members.entities.map((m) => `${m.name} in '${world.sourceOf?.(m.name) ?? 'db'}'`).join(', ')
      : 'this storage hands out no transaction';
    world.log.info(`${key} — compensated: ${why} — no isolation`);
    scope.registerValue(key, {
      run: <R>(fn: (entities: never, providers: never) => Promise<R>): Promise<R> => ambient.enterFrame(key, async () => {
        const journal: Undo[] = [];
        const record = (orm: EntityOrm, name: string, schema: SchemaView) =>
          judge(recording(orm, name, schema.getFields(), journal), name, schema);
        try {
          return await inScope(scope, members, world.ormFactory!, record, fn as never);
        } catch (cause) {
          return unwind(journal, cause, world.log);
        }
      }),
    });
  }
  if (registered > 0 && ambient.degraded) {
    world.log.warn(
      'no async context on this runtime — frames run one at a time, and a frame opened '
      + 'inside another times out instead of being refused',
    );
  }
}
