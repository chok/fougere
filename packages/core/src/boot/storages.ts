import type { Container } from '@fougere/container';
import type { Plugged } from '../wire/Plugged.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import { lowerFirst, type Fields, type SchemaView } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import { type OwnLogger } from '../builtin/OwnLoggers.js';
import { nameOf } from '../descriptor/FrondDescriptor.js';
import type { EntityEntry } from '../descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import { registerFrames } from '../module/frame/together.js';
import { lifetimeOf } from '../lifetime.js';
import type { Diagnostic } from '../diagnostic.js';
import { ownersOf, sharedNames, storageInUserCode, crudOnOwned } from './ownership.js';
import { refuseValuesAsRows } from '../module/value/refusals.js';
import { refuseArityDrift } from './arity.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import type { GuardReport } from '../dispatch/GuardReport.js';
import { wrapping } from './ports.js';
import { repositoryKeyOf, seatOf } from '../prefab/Repository.js';
import { storageKeyOf, type Storage } from '../storage/Storage.js';
import { declares } from '../Source.js';
import { relationChecksOf, refuseUnwritableNull, releasing } from '../module/relation/relations.js';
import { RelationGuard } from '../module/relation/RelationGuard.js';
import type { Building } from './facades.js';
import type { Assembly } from './install.js';

export async function registerReads(
  frond: FrondDescriptor,
  scope: Container,
  entityByName: Map<string, unknown>,
  sourcesFactory: CreateAppOptions['sourcesFactory'],
  frondLog: Logger,
): Promise<void> {
  if (!frond.reads?.length) return;

  if (!sourcesFactory) {
    frondLog.warn(
      `[reads] ${frond.reads.join(', ')}: in frond.config.ts, but nothing here can read across sources, `
      + 'so a handler asking for Reads fails at its first call. Install @fougere/adapter-duckdb, or remove reads:.',
    );

    return;
  }

  const named = frond.reads
    .map((name) => entityByName.get(lowerFirst(name)))
    .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
  if (named.length !== frond.reads.length) {
    const missing = frond.reads.filter((name) => !entityByName.has(lowerFirst(name)));
    frondLog.warn(
      `[reads] ${missing.join(', ')}: in frond.config.ts, but no such entity exists in this app. Check the spelling.`,
    );
  }

  scope.registerValue('Reads', await sourcesFactory(named, frond.name));
  frondLog.debug(`cross-source reader over ${named.length} entit(ies)`);
}

function rowsOf(
  assembly: Assembly,
  owner: string,
  scope: Container,
  entity: { name: string; schema: SchemaView },
  realization: Storage,
  report?: GuardReport,
): Storage {
  const links = assembly.hostPortsOf.get(owner)?.get('Storage') ?? [];
  const linked = wrapping('Storage', links, realization, (dep) => scope.resolve(dep));
  const related = relationGuardOf(assembly, entity).guard(linked);

  return new StorageGuard(entity.schema.getFields(), entity.name, report).guard(related);
}

const relationGuards = new WeakMap<Assembly, Map<SchemaView, RelationGuard>>();

function relationGuardOf(assembly: Assembly, entity: { name: string; schema: SchemaView }): RelationGuard {
  const held = relationGuards.get(assembly) ?? new Map<SchemaView, RelationGuard>();
  relationGuards.set(assembly, held);
  const { rowHosts } = assembly;
  const guard = held.get(entity.schema)
    ?? new RelationGuard(entity.name, relationChecksOf(entity.schema, entity.name, rowHosts), releasing(rowHosts));
  held.set(entity.schema, guard);

  return guard;
}

export function registerStorages(
  frond: FrondDescriptor,
  assembly: Assembly,
  scope: Container,
  owners: Map<string, string>,
  frondLog: Logger,
): void {
  const { options, refused } = assembly;
  if (!options.storageFactory) return;

  const unenforced: string[] = [];
  for (const entity of frond.entities) {
    if (options.values?.sourceOf(entity.name) !== undefined) continue;
    const key = storageKeyOf(entity.name);
    const placed = options.sourceOf?.(entity.name);
    if (options.sourceOf && placed === undefined) {
      refused.push(sourceMissing(frond, entity));
      continue;
    }
    const source = placed ?? 'default';
    if (declares(entity.entityClass, 'unique') && options.enforces?.(source, 'unique') === false) {
      unenforced.push(`${entity.name} in '${source}'`);
    }
    const baseStorage = options.storageFactory(entity.entityClass, entity.name);

    const defaultHandler = frond.handlers.find((h) => h.address === entity.name && !h.surface);
    const outputSchema = defaultHandler?.outputOverride ?? (defaultHandler?.ctor as { __output?: SchemaView } | undefined)?.__output;
    const scoped = outputSchema && outputSchema !== entity.entityClass
      ? baseStorage.output(outputSchema)
      : baseStorage;

    refused.push(...refuseUnwritableNull(entity.entityClass, entity.name, entity.filePath));
    assembly.relations.push(...relationChecksOf(entity.entityClass, entity.name, assembly.rowHosts));
    const guarded = rowsOf(assembly, frond.name, scope, { name: entity.name, schema: entity.entityClass }, scoped);
    scope.registerValue(key, guarded);

    const repoKey = repositoryKeyOf(entity.name);
    const owner = owners.get(entity.name);
    if (owner) {
      frondLog.debug(`${entity.name} — owned by ${owner}, no default repository`);
    } else if (!scope.has(repoKey)) {
      scope.registerValue(repoKey, guarded);
    }
  }
  if (frond.entities.length > 0) {
    frondLog.debug(`${frond.entities.length} entity storage(s): ${frond.entities.map((e) => e.name).join(', ')}`);
  }
  if (unenforced.length > 0) {
    frondLog.warn(
      `${unenforced.join(', ')}: unique, but this source does not enforce it, so two writes at the same moment can both pass.`,
    );
  }
}

function sourceMissing(frond: FrondDescriptor, entity: FrondDescriptor['entities'][number]): Diagnostic {
  return {
    severity: 'blocking',
    code: 'source-missing',
    frond: frond.name,
    subject: entity.name,
    filePath: entity.filePath,
    message: `${entity.name} lives in no source: every entry of sources: lists its rows, so none holds the rest. `
      + `Add '${entity.name}' to the rows: of one, or give one source no rows: list.`,
  };
}

export function registerRepositories(frond: FrondDescriptor, scope: Container, refused: Diagnostic[], ownLogger: OwnLogger, plugged: Plugged[]): void {
  const byKey = new Map<string, ProviderEntry[]>();
  for (const provider of frond.providers) {
    const seat = seatOf(provider.ctor);
    if (seat.length !== 1) continue;
    const key = repositoryKeyOf(seat[0]!.name);
    byKey.set(key, [...(byKey.get(key) ?? []), provider]);
  }
  for (const [key, providers] of byKey) {
    if (providers.length > 1) {
      refused.push({
        severity: 'blocking',
        code: 'repository-twice',
        frond: frond.name,
        subject: key,
        filePath: providers[1]!.filePath,
        message: `${providers.map(nameOf).join(' and ')} both extend the repository ${key} answers, and one key has one `
          + 'answer. Keep one; the other may ask for it.',
      });
      continue;
    }
    const provider = providers[0]!;
    scope.register(key, provider.ctor, { deps: ownLogger(nameOf(provider), provider.deps), ...lifetimeOf(provider.ctor) });
    plugged.push({ point: `Repository<${seatOf(provider.ctor)[0]!.name}>`, by: 'type', frond: frond.name, answers: [nameOf(provider)] });
  }
}

export function registerSurfaceStorage(
  entity: EntityEntry,
  handler: HandlerEntry,
  surfaceScope: Container,
  building: Building,
): void {
  const { assembly, frond, frondLog } = building;
  const { options } = assembly;
  if (!options.storageFactory) return;

  const baseStorage = options.storageFactory(entity.entityClass, entity.name);
  const outputSchema = handler.outputOverride ?? (handler.ctor as { __output?: SchemaView }).__output;
  const narrowed = outputSchema && outputSchema !== entity.entityClass;
  const scoped = narrowed ? baseStorage.output(outputSchema) : baseStorage;
  const guarded = rowsOf(assembly, frond.name, surfaceScope, { name: entity.name, schema: entity.entityClass }, scoped, {
    ...(narrowed ? { view: (outputSchema as { getFields(): Fields }).getFields() } : {}),
    outOfView: (message) => frondLog.warn(message),
  });

  surfaceScope.registerValue(storageKeyOf(entity.name), guarded);
  surfaceScope.registerValue(repositoryKeyOf(entity.name), guarded);
}

export function ownershipOf(frond: FrondDescriptor, assembly: Assembly): Map<string, string> {
  const { entityByName, refused } = assembly;
  sharedNames(frond, refused);
  refuseArityDrift(frond, refused);
  const owners = ownersOf(frond.providers, frond.name, refused);
  const valued = (entity: string) => assembly.options.values?.sourceOf(entity) !== undefined;
  storageInUserCode(frond, owners, (entity) => entityByName.has(entity) && !valued(entity), refused);
  crudOnOwned(frond, owners, refused);
  refuseValuesAsRows(frond, valued, new Set(entityByName.keys()), refused);

  return owners;
}

export function registerFramesOf(frond: FrondDescriptor, assembly: Assembly, scope: Container, frondLog: Logger): void {
  const { container, entityByName, frondOf, options, refused } = assembly;
  const wanted = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors]
    .flatMap((declared) => declared.deps.map((key) => ({ key, filePath: declared.filePath })));

  registerFrames(scope, wanted, frond.providers, {
    entityByName,
    frondOf,
    hostedHere: (name) => !(options.remotes && name in options.remotes),
    storageFactory: options.storageFactory,
    sourceOf: options.sourceOf,
    transacts: options.transacts,
    transacted: options.transacted,
    rowsOf: (entity, realization) => {
      const owner = frondOf.get(entity.name) ?? frond.name;

      return rowsOf(assembly, owner, container.resolve<Container>(`frond:${owner}`), entity, realization);
    },
    log: frondLog,
  }, refused);
}
