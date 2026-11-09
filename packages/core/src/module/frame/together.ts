import { ambient } from '#ambient';
import { lifetimeOf } from '../../lifetime.js';
import { upperFirst, lowerFirst, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { entityOfStorageKey, membersOfTogetherKey, storageKeyOf, type Storage } from '../../storage/Storage.js';
import { type StorageFactory } from '../../storage/StorageFactory.js';
import type { Logger } from '../../builtin/Logger.js';
import type { ProviderEntry } from '../../descriptor/ProviderEntry.js';
import { recording, unwind, type Undo } from './frame.js';
import type { Diagnostic } from '../../diagnostic.js';

/** Everything the boot knows that a frame needs, gathered once for every frond. */
export interface FrameWorld {
  /** Every entity of every frond, by registration key. A frame crosses fronds by design. */
  entityByName: Map<string, SchemaView>;
  /** Which frond holds an entity — the question `remotes:` turns into a refusal. */
  frondOf: Map<string, string>;
  hostedHere: (frond: string) => boolean;
  storageFactory?: StorageFactory;
  sourceOf?: (entityName: string) => string | undefined;
  /** Whether that source hands one out — asked before the frame is built, not at the call. */
  transacts?: (source: string) => boolean;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /** A member's rows as its own frond hands them out — its links, then the guards. */
  rowsOf: (entity: { name: string; schema: SchemaView }, realization: Storage) => Storage;
  log: Logger;
}

interface Members {
  entities: { name: string; schema: SchemaView }[];
  providers: ProviderEntry[];
}

function resolve(
  names: { entities: string[]; providers: string[] },
  declared: readonly ProviderEntry[],
  world: FrameWorld,
  asked: Asked,
  refused: Diagnostic[],
): Members | undefined {
  const before = refused.length;
  const entities = entitiesNamed(names.entities, world, asked, refused);
  const providers = providersNamed(names.providers, declared, asked, refused);

  return refused.length === before ? { entities, providers } : undefined;
}

function entitiesNamed(
  named: readonly string[],
  world: FrameWorld,
  asked: Asked,
  refused: Diagnostic[],
): { name: string; schema: SchemaView }[] {
  return named.flatMap((member) => {
    const name = lowerFirst(member);
    const schema = world.entityByName.get(name);
    if (schema) return [{ name, schema }];

    refused.push({
      ...asked,
      code: 'together-entity-unknown',
      message: `Together<[…${member}…]>: there is no entity named ${member}. `
        + 'The first list takes entities; a repository or a service goes in the second.',
    });

    return [];
  });
}

function providersNamed(
  named: readonly string[],
  declared: readonly ProviderEntry[],
  asked: Asked,
  refused: Diagnostic[],
): ProviderEntry[] {
  return named.flatMap((member) => {
    const entry = declared.find((provider) => provider.ctor.name === member);
    if (entry) return [entry];

    refused.push({
      ...asked,
      code: 'together-provider-unknown',
      message: `Together<[…], [… ${member} …]>: this frond has no class named ${member}. `
        + 'The second list takes repositories and services of this frond.',
    });

    return [];
  });
}

type Asked = { severity: 'blocking'; filePath: string; subject: string };

function remoteMembers(members: Members, world: FrameWorld, asked: Asked, refused: Diagnostic[]): void {
  for (const member of members.entities) {
    const frond = world.frondOf.get(member.name);
    if (frond && !world.hostedHere(frond)) {
      refused.push({
        ...asked,
        code: 'together-member-remote',
        message: `${member.name} belongs to the frond '${frond}', which runs in another process, so Together cannot include it. `
          + 'Run that frond here, or split the work in two and link the halves with a fact.',
      });
    }
  }
}

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
        message: `${provider.ctor.name} writes ${entity}, which this Together does not list. Add it: `
          + `Together<[…, ${upperFirst(entity)}], …>.`,
      });
    }
  }
}

async function inScope<R>(
  parent: Container,
  members: Members,
  factory: StorageFactory,
  wrap: (member: { name: string; schema: SchemaView }, realization: Storage) => Storage,
  fn: (entities: unknown[], providers: unknown[]) => Promise<R>,
): Promise<R> {
  const scope = parent.createScope();
  try {
    const storages = members.entities.map((member) => {
      const storage = wrap(member, factory(member.schema, member.name));
      scope.registerValue(storageKeyOf(member.name), storage);

      return storage;
    });
    const instances = members.providers.map((provider) => {
      scope.register(provider.ctor.name, provider.ctor, { deps: provider.deps, ...lifetimeOf(provider.ctor) });

      return scope.resolve(provider.ctor.name);
    });

    return await fn(storages, instances);
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
        message: `Together<[${names.entities.join(', ')}]> needs a storage, and this app has none.`,
      });
      continue;
    }

    const members = resolve(names, providers, world, asked, refused);
    if (!members) continue;

    remoteMembers(members, world, asked, refused);
    uncoveredWrites(members, world, asked, refused);
    scope.registerValue(key, frameOver(key, members, scope, world));
  }

  if (registered > 0 && ambient.degraded) {
    world.log.warn(
      'This runtime has no async context: Together runs one at a time, and one opened inside another times out. '
        + 'On a Worker, add "nodejs_compat" to compatibility_flags.',
    );
  }
}

function frameOver(key: string, members: Members, scope: Container, world: FrameWorld): Frame {
  const sources = new Set(members.entities.map((member) => world.sourceOf?.(member.name) ?? 'default'));
  const source = sources.size === 1 ? [...sources][0]! : undefined;
  if (world.transacted && source !== undefined && (world.transacts?.(source) ?? true)) {
    world.log.info(`${key} — transaction, source '${source}'`);

    return {
      run: <R>(fn: (entities: never, providers: never) => Promise<R>) =>
        ambient.enterFrame(key, () =>
          world.transacted!(source, (factory) => inScope(scope, members, factory, world.rowsOf, fn as never))),
    };
  }

  const why = sources.size > 1
    ? members.entities.map((one) => `${one.name} in '${world.sourceOf?.(one.name) ?? 'default'}'`).join(', ')
    : 'this storage hands out no transaction';
  world.log.info(`${key} — compensated: ${why} — no isolation`);

  return {
    run: <R>(fn: (entities: never, providers: never) => Promise<R>): Promise<R> => ambient.enterFrame(key, async () => {
      const journal: Undo[] = [];
      const record = (member: { name: string; schema: SchemaView }, realization: Storage) =>
        world.rowsOf(member, recording(realization, member.name, member.schema, journal));
      try {
        return await inScope(scope, members, world.storageFactory!, record, fn as never);
      } catch (cause) {
        return unwind(journal, cause, world.log);
      }
    }),
  };
}

interface Frame {
  run<R>(fn: (entities: never, providers: never) => Promise<R>): Promise<R>;
}
