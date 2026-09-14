/**
 * Building a frame — what a handler asking for `Together<[…]>` receives.
 *
 * Documented: [together](https://fougere.dev/docs/business/together).
 */
import { ambient } from '#ambient';
import { upperFirst, lowerFirst, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { entityOfStorageKey, membersOfTogetherKey, storageKeyOf, type Storage } from '../storage/Storage.js';
import { type StorageFactory } from '../storage/StorageFactory.js';
import type { Logger } from '../builtin/Logger.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import { heldBy, releasing } from './relations.js';
import type { Hosting } from './Hosting.js';
import { recording, unwind, type Undo } from './frame.js';
import type { Diagnostic } from '../diagnostic.js';

/** Everything the boot knows that a frame needs, gathered once for every frond. */
export interface FrameWorld {
  /** Every entity of every frond, by registration key. A frame crosses fronds by design. */
  entityByName: Map<string, SchemaView>;
  /** Which frond holds an entity — the question `remotes:` turns into a refusal. */
  frondOf: Map<string, string>;
  hostedHere: (frond: string) => boolean;
  storageFactory?: StorageFactory;
  sourceOf?: (entityName: string) => string;
  /** Whether that source hands one out — asked before the frame is built, not at the call. */
  transacts?: (source: string) => boolean;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /** What a member's references ask before a write — the answer its frond's own storage gets. */
  hosting: Hosting;
  log: Logger;
}

/** An entity the block writes through, and a provider rebuilt so that its writes count too. */
interface Members {
  entities: { name: string; schema: SchemaView }[];
  providers: ProviderEntry[];
}

/** Each declared name, resolved to what it designates — or nothing, and why. */
function resolve(
  names: { entities: string[]; providers: string[] },
  declared: readonly ProviderEntry[],
  world: FrameWorld,
  asked: Asked,
  refused: Diagnostic[],
): Members | undefined {
  const before = refused.length;

  const entities = names.entities.flatMap((member) => {
    const name = lowerFirst(member);
    const schema = world.entityByName.get(name);
    if (!schema) {
      refused.push({
        ...asked,
        code: 'together-entity-unknown',
        message: `Together<[…${member}…]>: no entity named '${member}' is scanned in this app. `
          + 'The first list names entities; a class of this frond goes in the second.',
      });

      return [];
    }

    return [{ name, schema }];
  });

  const providers = names.providers.flatMap((member) => {
    const entry = declared.find((provider) => provider.ctor.name === member);
    if (!entry) {
      refused.push({
        ...asked,
        code: 'together-provider-unknown',
        message: `Together<[…], [… ${member} …]>: this frond declares no class named '${member}'. `
          + 'The second list names providers to rebuild inside the frame — a service, a mirror, '
          + 'a repository — so that what they write is covered by the unwind.',
      });

      return [];
    }

    return [entry];
  });

  return refused.length === before ? { entities, providers } : undefined;
}

/** Who asked for the frame, and where they wrote it — the same three fields every refusal here carries. */
type Asked = { severity: 'blocking'; filePath: string; subject: string };

/** A member that cannot write here at all — its frond is hosted elsewhere. */
function remoteMembers(members: Members, world: FrameWorld, asked: Asked, refused: Diagnostic[]): void {
  for (const member of members.entities) {
    const frond = world.frondOf.get(member.name);
    if (frond && !world.hostedHere(frond)) {
      refused.push({
        ...asked,
        code: 'together-member-remote',
        message: `'${member.name}' belongs to frond '${frond}', which this process declares in `
          + 'remotes: — it registers no storage here, so its writes cannot be part of a frame. '
          + 'Host the frond here, or split the work and join the halves with a fact.',
      });
    }
  }
}

/** A provider member writing an entity the frame does not name. */
function uncoveredWrites(members: Members, world: FrameWorld, asked: Asked, refused: Diagnostic[]): void {
  const covered = new Set(members.entities.map((member) => member.name));
  for (const provider of members.providers) {
    for (const dep of provider.deps) {
      const entity = entityOfStorageKey(dep, (name) => world.entityByName.has(name));
      if (!entity || covered.has(entity)) continue;
      refused.push({
        ...asked,
        filePath: provider.filePath,
        code: 'together-write-uncovered',
        message: `${provider.ctor.name} writes ${entity}, which is not in the frame's entity list `
          + `— its writes would escape the unwind. Add it: `
          + `Together<[…, ${upperFirst(entity)}], [… ${provider.ctor.name} …]>.`,
      });
    }
  }
}

/** Open the block. */
async function inScope<R>(
  parent: Container,
  members: Members,
  factory: StorageFactory,
  wrap: (storage: Storage, name: string, schema: SchemaView) => Storage,
  fn: (entities: unknown[], providers: unknown[]) => Promise<R>,
): Promise<R> {
  const scope = parent.createScope();
  try {
    const storages = members.entities.map((member) => {
      const storage = wrap(factory(member.schema, member.name), member.name, member.schema);
      scope.registerValue(storageKeyOf(member.name), storage);
      return storage;
    });
    // Providers after every storage is in place: one may depend on another member's.
    const built = members.providers.map((provider) => {
      scope.register(provider.ctor.name, provider.ctor, { deps: provider.deps });
      return scope.resolve(provider.ctor.name);
    });
    return await fn(storages, built);
  } finally {
    await scope.dispose();
  }
}

/** Register one frame per key a handler or provider of this frond asked for. */
export function registerFrames(
  scope: Container,
  wanted: Iterable<{ key: string; filePath: string }>,
  providers: readonly ProviderEntry[],
  world: FrameWorld,
  refused: Diagnostic[],
): void {
  let registered = 0;
  const seen = new Set<string>();
  for (const { key, filePath } of wanted) {
    if (seen.has(key)) continue;
    seen.add(key);
    const names = membersOfTogetherKey(key);
    if (!names) continue;
    registered += 1;
    const asked = { severity: 'blocking', filePath, subject: key } as const;
    if (!world.storageFactory) {
      refused.push({
        ...asked,
        code: 'together-needs-storage',
        message: `Together<[${names.entities.join(', ')}]> needs storage, and this boot declares none.`,
      });
      continue;
    }

    const members = resolve(names, providers, world, asked, refused);
    // Nothing left to build a frame out of, and the refusals above already say what is missing.
    if (!members) continue;
    remoteMembers(members, world, asked, refused);
    uncoveredWrites(members, world, asked, refused);

    const sources = new Set(members.entities.map((member) => world.sourceOf?.(member.name) ?? 'db'));
    const validator = (storage: Storage, name: string, schema: SchemaView) =>
      new StorageGuard(schema.getFields(), name, {}, heldBy(schema, name, world.hosting), releasing(world.hosting)).guard(storage);

    // One engine and a way into it: the engine gives the unwind AND the isolation. The
    // question goes to the source these members live in — a composition answering for the
    // default one would compensate a frame whose own engine holds transactions.
    const source = sources.size === 1 ? [...sources][0]! : undefined;
    if (world.transacted && source !== undefined && (world.transacts?.(source) ?? true)) {
      world.log.info(`${key} — transaction, source '${source}'`);
      scope.registerValue(key, {
        run: <R>(fn: (entities: never, providers: never) => Promise<R>) =>
          ambient.enterFrame(key, () =>
            world.transacted!(source, (factory) => inScope(scope, members, factory, validator, fn as never))),
      });
      continue;
    }

    // Split, or an engine that hands out no transaction: the frame keeps the before-image
    // of every write and replays the inverses itself. `validator` stays OUTSIDE `recording`, so
    // a write the entity refuses never enters the journal.
    const why = sources.size > 1
      ? members.entities.map((m) => `${m.name} in '${world.sourceOf?.(m.name) ?? 'db'}'`).join(', ')
      : 'this storage hands out no transaction';
    world.log.info(`${key} — compensated: ${why} — no isolation`);
    scope.registerValue(key, {
      run: <R>(fn: (entities: never, providers: never) => Promise<R>): Promise<R> => ambient.enterFrame(key, async () => {
        const journal: Undo[] = [];
        const record = (storage: Storage, name: string, schema: SchemaView) =>
          validator(recording(storage, name, schema, journal), name, schema);
        try {
          return await inScope(scope, members, world.storageFactory!, record, fn as never);
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
