import { lowerFirst, upperFirst } from '@fougere/schema';
import { nameOf, type FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { type ProviderEntry } from '../descriptor/ProviderEntry.js';
import { extendsRepository } from '../prefab/RepositoryOps.js';
import { targetOf } from '../prefab/prefab.js';
import { ownedBy, seatOf } from '../prefab/Repository.js';
import { entityOfStorageKey, membersOfTogetherKey } from '../storage/Storage.js';
import type { Diagnostic } from '../diagnostic.js';

/** One name, one file: two providers under one key and the second silently replaces the first. */
export function sharedNames(frond: FrondDescriptor, refused: Diagnostic[]): void {
  const declared = new Map<string, string>();

  for (const provider of frond.providers) {
    const name = nameOf(provider);
    const first = declared.get(name);
    if (first !== undefined) {
      refused.push({
        severity: 'blocking',
        code: 'provider-name-taken',
        filePath: provider.filePath,
        frond: frond.name,
        subject: name,
        message: `Two classes are named ${name}, here and in ${first}. Rename one.`,
      });
    }
    declared.set(name, provider.filePath);
  }
}

/** Who owns an entity's storage. */
export function ownersOf(
  providers: readonly ProviderEntry[],
  frond: string,
  refused: Diagnostic[],
): Map<string, string> {
  const owners = new Map<string, string>();
  /** Claimed twice, so it has no owner — and no owner is nobody to judge a reader against. */
  const contested = new Set<string>();
  for (const provider of providers) {
    const owned = ownedBy(provider.ctor);
    if (owned.length < 2) continue;
    for (const entity of owned) {
      const name = lowerFirst((entity as { name: string }).name);
      const first = owners.get(name);
      if (first && first !== provider.ctor.name) {
        // Refused rather than settled, for the reason `ports:` refuses two implementations
        // and `remotes` two owners of an entity: whichever won would depend on scan order,
        // and one of the two aggregates would be silently unenforced.
        refused.push({
          severity: 'blocking',
          code: 'entity-owned-twice',
          filePath: provider.filePath,
          frond,
          subject: name,
          message: `${name} is in both ${first} and ${provider.ctor.name}. Keep it in one.`,
        });
        contested.add(name);
        continue;
      }
      owners.set(name, provider.ctor.name);
    }
  }
  // The second claimant is BUILT ON what it claims, so `storageInUserCode` would read it as
  // reaching around the first — two more refusals naming the same declaration, in the one
  // case where the answer to "who owns this" is already the diagnostic above.
  for (const name of contested) owners.delete(name);

  return owners;
}

/**
 * The entities a class was BUILT ON — what a prefab may legitimately be handed the storage
 * of. Empty for a plain service, which is why one cannot ask for a storage at all.
 */
function entitiesOfPrefab(ctor: unknown): string[] {
  const owned = ownedBy(ctor);
  if (owned.length > 0) return owned.map((e) => lowerFirst((e as { name: string }).name));
  const target = targetOf(ctor) as { name?: string } | undefined;

  return target?.name ? [lowerFirst(target.name)] : [];
}

/**
 * Storage is reached through a repository, and an OWNED entity's not even that way: an aggregate's
 * members are reached through it and nowhere else. The ownership question is asked first, so a
 * member says who owns it rather than being told to write a repository it may not have.
 */
function refuseStorageReached(
  decl: { ctor: { name: string }; deps: string[]; filePath: string; kind: string },
  frond: string,
  owners: Map<string, string>,
  known: (entity: string) => boolean,
  refused: Diagnostic[],
): void {
  const allowed = decl.kind === 'provider' || seatOf(decl.ctor).length > 0 ? entitiesOfPrefab(decl.ctor) : [];

  for (const dep of decl.deps) {
    const framed = membersOfTogetherKey(dep);
    if (framed) {
      const members = framed.entities.map(lowerFirst).filter(known);
      for (const entity of members) reachesOwned(decl, dep, entity, frond, owners, refused);
      continue;
    }

    const entity = entityOfStorageKey(dep, known);
    if (!entity) continue;
    if (reachesOwned(decl, dep, entity, frond, owners, refused)) continue;
    if (allowed.includes(entity)) continue;

    refused.push({
      severity: 'blocking',
      code: 'storage-outside-repository',
      filePath: decl.filePath,
      frond,
      subject: `${decl.ctor.name}(${dep})`,
      message: `${decl.ctor.name} asks for ${dep}. Ask for the repository instead: `
        + `constructor(private ${entity}: Repository<${upperFirst(entity)}>) {}.`,
    });
  }
}

/** Whether `dep` reaches an entity an aggregate other than `decl` owns — a frame as much as a storage. */
function reachesOwned(
  decl: { ctor: { name: string }; filePath: string },
  dep: string,
  entity: string,
  frond: string,
  owners: Map<string, string>,
  refused: Diagnostic[],
): boolean {
  const owner = owners.get(entity);
  if (!owner || owner === decl.ctor.name) return false;

  refused.push({
    severity: 'blocking',
    code: 'aggregate-storage-reached',
    filePath: decl.filePath,
    frond,
    subject: `${decl.ctor.name}(${dep})`,
    message: `${decl.ctor.name} asks for ${dep}, but ${entity} belongs to ${owner}. Ask for that instead: `
      + `constructor(private ${entity}: ${owner}) {}.`,
  });

  return true;
}

export function storageInUserCode(
  frond: FrondDescriptor,
  owners: Map<string, string>,
  known: (entity: string) => boolean,
  refused: Diagnostic[],
): void {
  const facades = [
    ...frond.handlers.map((h) => ({ ...h, kind: 'handler' })),
    ...frond.presenters.map((p) => ({ ...p, kind: 'presenter' })),
    ...frond.collectors.map((c) => ({ ...c, kind: 'collector' })),
  ];
  const holders = frond.providers.map((p) => ({ ...p, kind: 'provider' as const }));

  for (const decl of [...facades, ...holders]) {
    refuseStorageReached(decl, frond.name, owners, known, refused);
  }
}

/** An owned entity has no automatic CRUD — said at boot, not at the first request. */
export function crudOnOwned(
  frond: FrondDescriptor,
  owners: Map<string, string>,
  refused: Diagnostic[],
): void {
  for (const handler of frond.handlers) {
    // What it extends the repository of — seated by the boot — or, for a prefab, its address.
    const built = seatOf(handler.ctor).map((entity) => lowerFirst(entity.name));
    const subject = built.find((entity) => owners.has(entity))
      ?? (built.length === 0 && handler.deps.length === 0 && extendsRepository(handler.ctor) ? handler.address : undefined);
    const owner = subject && owners.get(subject);
    if (!subject || !owner || owners.get(subject) === handler.ctor.name) continue;

    refused.push({
      severity: 'blocking',
      code: 'crud-on-owned-entity',
      filePath: handler.filePath,
      frond: frond.name,
      subject: handler.ctor.name,
      message: `${handler.ctor.name} extends Repository<${upperFirst(subject)}>, but ${subject} belongs to ${owner}. `
        + `Drop it and ask for the owner: constructor(private ${subject}: ${owner}) {}.`,
    });
  }
}
