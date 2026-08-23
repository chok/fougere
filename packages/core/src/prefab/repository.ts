import { classNameOf, type EntityConstructor } from '@fougere/schema';
import type { EntityOrm, ListOptions, ListResult, SelectOption } from '../orm.js';
import type { SchemaView } from '@fougere/schema';

/**
 * Repository(…entities) — who owns an entity's storage, and where its questions are named.
 *
 * **The arity decides**, which is the second reading of what `orm.ts` already states for
 * `EntityOrm` against `Together`: the arity of the unit is the whole distinction.
 *
 * ONE entity — the repository IS that entity's storage, with your methods added. The port's
 * thirteen gestures are forwarded, so a handler reads `this.posts.list()` whether or not
 * anyone wrote the file, and a named question sits beside them:
 *
 * ```ts
 * // repositories/PostRepository.ts
 * export default class PostRepository extends Repository(Post) {
 *   published() {
 *     return this.list({ where: { status: 'published' }, orderBy: 'publishedAt', order: 'desc' });
 *   }
 * }
 * ```
 *
 * TWO OR MORE — an aggregate. It owns them: nothing else in the app is handed their
 * storage, and no gesture is forwarded (which entity would `create` write to?), so the only
 * way in is a method this class names. That is what lets a rule spanning two tables exist:
 * it is ordinary TypeScript inside the method that does the writing.
 *
 * ```ts
 * // repositories/CommandeRepository.ts
 * export default class CommandeRepository extends Repository(Commande, Stock) {
 *   avecLignes(id: string) {
 *     const [commandes, stock] = this.orms;
 *     …
 *   }
 * }
 * ```
 *
 * `this.orms` is protected, because the whole point is that the storage stops at this file.
 * `protected` is erased at runtime, like `abstract` on a port: a compile-time guarantee, not
 * a barrier. The same bargain, already accepted.
 *
 * **The boundary is not the unit of work.** An aggregate says the rules of these entities
 * hold together; a frame says these writes land together, and the two lists coincide only
 * often. Deriving the frame from the membership would make a read-only aggregate carry one
 * — refusals included, and `registerFrames` refuses without storage or over `remotes:` —
 * and would put `Together<[Commande, Stock], [StockMirror]>` out of reach forever. So a
 * frame is ASKED FOR here as anywhere else, which is what makes it declared:
 *
 * ```ts
 * constructor(commandes: CommandeOrm, stock: StockOrm, private frame: Together<[Commande, Stock]>) {
 *   super(commandes, stock);
 * }
 * ```
 *
 * The ORM words come back in that line, and only there: this class IS the holder, which is
 * the one case `boot/ownership.ts` lets name the storage it was built on.
 *
 * A repository is NOT a door: it has no façade, so nothing here is reachable from the wire.
 */

/**
 * The shape a repository of ONE entity has — the port itself, plus whatever the subclass
 * names on top. Written by an author who has not written the file: `RepositoryOf<Post>` is
 * to `PostRepository` what `EntityOrm<Post>` is to `PostOrm`, one spelling of one key, and
 * `depKeyOf` reads both.
 */
export type RepositoryOf<T> = EntityOrm<T>;

/** The single-entity form: the port, plus whatever the subclass names. */
export interface RepositoryConstructor<T> {
  new (orm: EntityOrm<T>): EntityOrm<T>;
  readonly __entity: unknown;
}

/**
 * What an aggregate's subclass sees: the storage of the members it owns, in declared order,
 * and `protected` — the storage stops at that file, which is the whole mechanism.
 *
 * A class and not an interface, because `protected` cannot be spelled in one. Ambient: the
 * value it describes is fabricated by `many()` for an arity only known at the call.
 */
declare abstract class AggregateShape<E extends readonly EntityConstructor[]> {
  protected orms: { [K in keyof E]: EntityOrm<InstanceType<E[K]>> };
}

/** The tuple an aggregate holds — the readable form of {@link AggregateShape}'s member. */
export type AggregateOf<E extends readonly EntityConstructor[]> =
  { [K in keyof E]: EntityOrm<InstanceType<E[K]>> };

export type AggregateConstructor<E extends readonly EntityConstructor[]> =
  (new (...orms: unknown[]) => AggregateShape<E>) & {
    readonly __entity: unknown;
    /** The entities this class owns. Present from two on — an owner of one owns nothing. */
    readonly __owns: E;
  };

export function Repository<E extends EntityConstructor>(entity: E): RepositoryConstructor<InstanceType<E>>;
export function Repository<E extends readonly [EntityConstructor, EntityConstructor, ...EntityConstructor[]]>(
  ...entities: E
): AggregateConstructor<E>;
export function Repository(...entities: EntityConstructor[]): unknown {
  return entities.length === 1 ? one(entities[0]) : many(entities);
}

/**
 * The port forwarded, member by member. Written out rather than proxied: a Proxy would
 * answer every name including the ones the port does not have, and this file would then
 * state the surface nowhere. Thirteen lines against one declaration that can be read.
 */
function one<E extends EntityConstructor>(entity: E): RepositoryConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  class RepositoryBase implements EntityOrm<T> {
    static readonly __entity = entity;

    constructor(protected orm: EntityOrm<T>) {}

    list(options?: ListOptions & SelectOption): Promise<ListResult<T>> { return this.orm.list(options); }
    findById(id: string, options?: SelectOption) { return this.orm.findById(id, options); }
    findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption) { return this.orm.findBy(criteria, options); }
    findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption) { return this.orm.findAllBy(criteria, options); }
    findByKeys(ids: readonly string[], options?: SelectOption) { return this.orm.findByKeys(ids, options); }
    findAllByKeys(field: string, keys: readonly string[], options?: SelectOption) { return this.orm.findAllByKeys(field, keys, options); }
    create(input: Partial<T>, options?: SelectOption) { return this.orm.create(input, options); }
    upsert(input: Partial<T>, options?: SelectOption) { return this.orm.upsert(input, options); }
    upsertAll(inputs: readonly Partial<T>[], options?: SelectOption) { return this.orm.upsertAll(inputs, options); }
    update(id: string, input: Partial<T>, options?: SelectOption) { return this.orm.update(id, input, options); }
    delete(id: string) { return this.orm.delete(id); }
    output(schema: SchemaView) { return this.orm.output(schema); }
    get client(): unknown { return this.orm.client; }
  }

  return RepositoryBase as unknown as RepositoryConstructor<T>;
}

/**
 * The aggregate. Its constructor takes the members' storage in the DECLARED order — the
 * order `toProvider` fills its `deps` with, and the order a subclass hands back to `super()`
 * when it declares a constructor of its own.
 */
function many<E extends readonly EntityConstructor[]>(entities: E): AggregateConstructor<E> {
  class AggregateBase {
    static readonly __entity = entities[0];
    static readonly __owns = entities;

    protected orms: AggregateOf<E>;

    constructor(...orms: unknown[]) {
      this.orms = orms.slice(0, entities.length) as AggregateOf<E>;
    }
  }

  return AggregateBase as unknown as AggregateConstructor<E>;
}

/** Container key of an entity's repository — 'reading' → 'ReadingRepository'. */
export function repositoryKeyOf(entity: string): string {
  return `${classNameOf(entity)}Repository`;
}

/**
 * The entities a class owns — empty for anything that is not an aggregate.
 *
 * Read from the mark rather than from the constructor, for the reason `Crud.__ops` exists:
 * the AST scan is workspace-only, so an installed prefab resolves to nothing.
 */
export function ownedBy(ctor: unknown): readonly EntityConstructor[] {
  return (ctor as { __owns?: readonly EntityConstructor[] } | undefined)?.__owns ?? [];
}
