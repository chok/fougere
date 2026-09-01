import { lowerFirst } from '@fougere/schema';
import type { FrondDescriptor, ProviderEntry } from '../descriptor/frond.js';
import { targetOf } from '../prefab/prefab.js';
import { ownedBy, repositoryKeyOf } from '../prefab/repository.js';
import { entityOfStorageKey } from '../storage.js';

/**
 * Who owns an entity's storage.
 *
 * `Repository(Commande, Stock)` states it — an aggregate is the only thing that claims
 * entities it is not named after, and the arity is what says so. A repository of ONE owns
 * nothing: a boundary between one thing and nothing is not a boundary, and the judge is
 * already on that entity's rows.
 */
export function ownersOf(providers: readonly ProviderEntry[]): Map<string, string> {
  const owners = new Map<string, string>();
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
        throw new Error(
          `[aggregate] ${first} and ${provider.ctor.name} both own ${name}. `
          + 'An entity has one owner: merge the two, or take it out of one of them.',
        );
      }
      owners.set(name, provider.ctor.name);
    }
  }
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

/**
 * `Storage<E>` is not a word of the user's vocabulary — `<E>Repository` is the one way in.
 *
 * A door judges and projects; a HOLDER keeps the storage. So the rule is not about which
 * directory a file sits in but about which of the two a class is: a handler, a presenter and
 * a collector may never name the port, and a provider may name only the storage of what its
 * prefab was built on — which is `Repository` and `Mirror`, without either being named here.
 *
 * What it buys beyond one word instead of two: an entity that becomes owned later needs no
 * call site to move, because none of them ever spelled the storage.
 *
 * `known` answers what the key's suffix cannot: `FileStorage` is an ordinary class name.
 *
 * Refused at boot rather than reported by `verify`, which nothing calls at startup.
 */
export function refuseStorageInUserCode(
  frond: FrondDescriptor,
  owners: Map<string, string>,
  known: (entity: string) => boolean,
): void {
  const doors = [
    ...frond.handlers.map((h) => ({ ...h, kind: 'handler' })),
    ...frond.presenters.map((p) => ({ ...p, kind: 'presenter' })),
    ...frond.collectors.map((c) => ({ ...c, kind: 'collector' })),
  ];
  const holders = frond.providers.map((p) => ({ ...p, kind: 'provider' as const }));

  for (const decl of [...doors, ...holders]) {
    const allowed = decl.kind === 'provider' ? builtOn(decl.ctor) : [];
    for (const dep of decl.deps) {
      const entity = entityOfStorageKey(dep, known);
      if (!entity) continue;

      const owner = owners.get(entity);
      if (owner && owner !== decl.ctor.name) {
        throw new Error(
          `[aggregate] ${decl.ctor.name} asks for ${dep}, and ${owner} owns ${entity}.\n`
          + `  Nothing else reaches an owned entity's storage — name the operation on `
          + `${owner} and ask for it:\n`
          + `    constructor(private ${entity}: ${owner}) {}\n`
          + `  ${decl.filePath}`,
        );
      }
      if (allowed.includes(entity)) continue;

      throw new Error(
        `${decl.ctor.name} asks for ${dep}. Storage is reached through a repository, `
        + `never through the port:\n`
        + `    constructor(private ${entity}: ${repositoryKeyOf(entity)}) {}\n`
        + `  It answers every gesture ${dep} does, whether or not anyone wrote the file — `
        + `and the day ${entity} belongs to an aggregate, this line does not move.\n`
        + `  ${decl.filePath}`,
      );
    }
  }
}

/**
 * An owned entity has no automatic CRUD — said at boot, not at the first request.
 *
 * `HandlerFacade.deps()` asks for `<E>Repository` when a handler inherits the five gestures
 * and declares no constructor of its own, and an owned entity has no such key. That alone
 * refuses — but LAZILY, at the first call, on the container's own sentence: measured, the app
 * booted clean and answered every request with `'LedgerRepository' is not registered`. A
 * receiver that starts and then rejects everything is found in production, which is the
 * reason `serve()` checks its address at boot rather than per call.
 *
 * Recognized by FORM, like the façade recognizes it: a prototype carrying `list` and
 * `findById` needs storage of its own, whether `Crud()` put them there or an author did.
 */
export function refuseCrudOnOwned(frond: FrondDescriptor, owners: Map<string, string>): void {
  for (const handler of frond.handlers) {
    const owner = owners.get(handler.address);
    if (!owner || handler.deps.length > 0) continue;
    const proto = (handler.ctor as { prototype?: Record<string, unknown> }).prototype;
    if (typeof proto?.list !== 'function' || typeof proto?.findById !== 'function') continue;

    throw new Error(
      `[aggregate] ${handler.ctor.name} takes the five gestures on ${handler.address}, `
      + `which ${owner} owns.\n`
      + `  An owned entity has no automatic CRUD: nothing writes it but its owner, so there `
      + `is no storage to hand this handler.\n`
      + `  Name the operations on ${owner} and call them:\n`
      + `    constructor(private ${handler.address}: ${owner}) {}\n`
      + `  ${handler.filePath}`,
    );
  }
}
