import { lowerFirst } from '@fougere/schema';
import { nameOf, type FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { type ProviderEntry } from '../descriptor/ProviderEntry.js';
import { inheritsCrud } from '../prefab/CrudConstructor.js';
import { targetOf } from '../prefab/prefab.js';
import { ownedBy, repositoryKeyOf } from '../prefab/RepositoryConstructor.js';
import { entityOfStorageKey } from '../storage/port.js';
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
        message: `${first} already declares ${name}. A frond registers both under one key, so the `
          + `second replaces the first and whoever asks for ${name} is handed whichever was `
          + 'scanned last. Rename one of the two.',
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
          message: `${first} and ${provider.ctor.name} both own ${name}. An entity has one owner: `
            + 'merge the two, or take it out of one of them.',
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
function builtOn(ctor: unknown): string[] {
  const owned = ownedBy(ctor);
  if (owned.length > 0) return owned.map((e) => lowerFirst((e as { name: string }).name));
  const target = targetOf(ctor) as { name?: string } | undefined;
  return target?.name ? [lowerFirst(target.name)] : [];
}

/** `Storage<E>` is not a word of the user's vocabulary — `<E>Repository` is the one way in. */
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

  for (const provider of holders) {
    // The key the boot registers it under, which a bundler may have renamed — the same
    // reading `ProviderEntry.name` exists for.
    const registered = nameOf(provider);
    const held = entityOfStorageKey(registered, known);
    if (!held) continue;

    refused.push({
      severity: 'blocking',
      code: 'storage-key-is-provider',
      filePath: provider.filePath,
      frond: frond.name,
      subject: registered,
      message: `${registered} is a provider, and it is the container key of ${held}'s own storage `
        + '— the storage is registered second, so the provider is never resolved. Name it for '
        + 'what it holds; `<Entity>Storage` belongs to the entity.',
    });
  }

  for (const decl of [...facades, ...holders]) {
    const allowed = decl.kind === 'provider' ? builtOn(decl.ctor) : [];
    for (const dep of decl.deps) {
      const entity = entityOfStorageKey(dep, known);
      if (!entity) continue;

      const owner = owners.get(entity);
      if (owner && owner !== decl.ctor.name) {
        refused.push({
          severity: 'blocking',
          code: 'aggregate-storage-reached',
          filePath: decl.filePath,
          frond: frond.name,
          subject: `${decl.ctor.name}(${dep})`,
          message: `${decl.ctor.name} asks for ${dep}, and ${owner} owns ${entity}. Nothing else `
            + `reaches an owned entity's storage — name the operation on ${owner} and ask for it: `
            + `constructor(private ${entity}: ${owner}) {}`,
        });
        continue;
      }
      if (allowed.includes(entity)) continue;

      refused.push({
        severity: 'blocking',
        code: 'storage-outside-repository',
        filePath: decl.filePath,
        frond: frond.name,
        subject: `${decl.ctor.name}(${dep})`,
        message: `${decl.ctor.name} asks for ${dep}. Storage is reached through a repository, never `
          + `through the port: constructor(private ${entity}: ${repositoryKeyOf(entity)}) {}. It `
          + `answers every gesture ${dep} does, whether or not anyone wrote the file — and the day `
          + `${entity} belongs to an aggregate, this line does not move.`,
      });
    }
  }
}

/** An owned entity has no automatic CRUD — said at boot, not at the first request. */
export function crudOnOwned(
  frond: FrondDescriptor,
  owners: Map<string, string>,
  refused: Diagnostic[],
): void {
  for (const handler of frond.handlers) {
    const owner = owners.get(handler.address);
    if (!owner || handler.deps.length > 0 || !inheritsCrud(handler.ctor)) continue;

    refused.push({
      severity: 'blocking',
      code: 'crud-on-owned-entity',
      filePath: handler.filePath,
      frond: frond.name,
      subject: handler.ctor.name,
      message: `${handler.ctor.name} takes the five gestures on ${handler.address}, which ${owner} `
        + 'owns. An owned entity has no automatic CRUD: nothing writes it but its owner, so there '
        + `is no storage to hand this handler. Name the operations on ${owner} and call them: `
        + `constructor(private ${handler.address}: ${owner}) {}`,
    });
  }
}
