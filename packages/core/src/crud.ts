import type { EntityOrm, ListOptions, ListResult } from './orm.js';
import type { OperationContract } from './operation.js';
import type { SchemaView } from '@fougere/schema';

/** The id of the row an op acts on — a route segment, or a query fallback. */
const byId = { name: 'id', source: { kind: 'param' as const, name: 'id' }, optional: false };
const fromBody = { name: 'input', source: { kind: 'body' as const }, optional: false };

/**
 * The same five, written as the scan would have written them.
 *
 * `binding` says WHERE an argument is read from; it never says of what type, and a
 * GraphQL argument needs the type. So a producer that fills only `binding` leaves
 * `adapter/graphql` with nothing to declare — it drops the op (`registerOperations`,
 * `if (!sig) continue`) and four of the five CRUD ops vanish from the schema while
 * the façade and REST still serve them. Measured on an installed app: 16 handlers,
 * 14 with unresolvable heritage, zero `createX` in the schema.
 */
const idParam = { name: 'id', type: { raw: 'string', name: 'string' } };
const inputParam = (entity: string) => ({ name: 'input', type: { raw: `Partial<${entity}>`, name: entity } });
const returns = (raw: string, name: string, extra?: { array?: boolean; nullable?: boolean }) =>
  ({ raw, name, ...extra });

/**
 * The five ops a Crud handler brings, declared rather than discovered.
 *
 * The mixin built them, so it alone knows their contract in full: what judges
 * their input, where each argument comes from. It says so on the class, at
 * runtime — which is what makes the guarantee independent of the AST scan (an
 * installed app cannot resolve this file, and never needs to).
 */
/**
 * `output` says the entity, and saying it costs nothing at runtime.
 *
 * The façade already projected onto the entity when nothing else was named, so this
 * changes no result: `outputFieldsFor` reads `contractOutput` and falls back to the
 * entity, and both are the same shape here. What changes is that the sentence now
 * EXISTS — the identity card publishes `output` per op, and a card was measured
 * carrying none at all (2026-08-06, ten ops, zero outputs), which typed every remote
 * return as `unknown` for anyone building on it.
 *
 * It does not close the view: only an explicit `__opOutputs` does (`closed: perOp !==
 * undefined`), so a named view still wins and a presenter's computed fields still ride
 * out. `delete` names none — a boolean is not a shape.
 */
function crudOps(entity: SchemaView & { partial?: () => SchemaView }): Record<string, OperationContract> {
  const name = (entity as { name?: string }).name ?? 'Entity';
  const input = inputParam(name);
  return {
    list: {
      output: entity, cardinality: 'page',
      binding: [{ name: 'options', source: { kind: 'query' }, optional: true }],
      signature: {
        name: 'list', returnType: returns(`ListResult<${name}>`, 'ListResult'),
        params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
      },
    },
    findById: {
      output: entity, cardinality: 'maybe', binding: [byId],
      signature: { name: 'findById', returnType: returns(`${name} | undefined`, name, { nullable: true }), params: [idParam] },
    },
    create: {
      input: entity, output: entity, cardinality: 'one', binding: [fromBody],
      signature: { name: 'create', returnType: returns(name, name), params: [input] },
    },
    // The patch view carries its own mode: an absent field is untouched, an
    // immutable one re-supplied is refused.
    update: {
      input: entity.partial?.(), output: entity, cardinality: 'one', binding: [byId, fromBody],
      signature: { name: 'update', returnType: returns(name, name), params: [idParam, input] },
    },
    delete: {
      cardinality: 'none', binding: [byId],
      signature: { name: 'delete', returnType: returns('boolean', 'boolean'), params: [idParam] },
    },
  };
}

/** Anything the derivation algebra produces — an entity class or one of its views. */
type SchemaCtor = abstract new (...args: any[]) => any;

/**
 * The mixin's single "trust me" point — the twin of `asSchemaConstructor` in @fougere/schema.
 *
 * The implementation returns whatever the ORM hands back; the declaration names the view
 * each op emits at the port. TypeScript cannot connect the two (the view is a runtime
 * argument, the type is a generic), so one assertion states that the mixin honours what it
 * declared — and the façade makes it true, projecting each op's result onto its view
 * (`outputFieldsFor` in `bootstrap.ts`).
 */
function asCrudConstructor<T, V>(impl: object): CrudConstructor<T, V> {
  return impl as CrudConstructor<T, V>;
}

/** The five ops the mixin fabricates. */
export type CrudOpName = 'list' | 'findById' | 'create' | 'update' | 'delete';

/** Which view each op speaks — omitted ops speak the entity, the trivial view. */
export type CrudViews = Partial<Record<CrudOpName, SchemaCtor>>;

/**
 * The view an op emits, fabricated: the one declared for it, the single view when the
 * whole handler declares one, the entity otherwise. `PostCard` is not a hand-written
 * type — `Post.pick(...)` derives it field by field, so an op's return is a projection
 * of the entity exactly like the entity is the projection that keeps everything.
 */
type OutOf<V, K extends CrudOpName, T> =
  // Bracketed on purpose: a naked `V extends …` DISTRIBUTES, and the no-view default
  // is the empty map, whose `keyof` is `never` — distribution would then collapse
  // every op's output to `never` instead of falling through to the entity.
  [V] extends [SchemaCtor] ? InstanceType<V & SchemaCtor>
  : K extends keyof V ? (V[K] extends SchemaCtor ? InstanceType<V[K]> : T)
  : T;

/**
 * The five ops, typed from the entity and its views.
 *
 * Two things the mixin declares but does not own. The **output** is the view the
 * handler names (`Crud(Post, { list: PostCard })`) — fabricated, so a redefinition
 * that returns cards stays assignable. The **trailing parameters** are resolved by
 * type from the container (`delete(id, user: User | null)` gets its user from a
 * collector): the mixin cannot know them, they belong to the app, so it declares that
 * a tail exists and that it supplies none — which is what `never` says, and what keeps
 * a judged redefinition assignable.
 */
export interface CrudOps<T, V = {}> {
  orm: EntityOrm<T>;
  list(options?: ListOptions, ...collected: never[]): Promise<ListResult<OutOf<V, 'list', T>>>;
  findById(id: string, ...collected: never[]): Promise<OutOf<V, 'findById', T> | undefined>;
  create(input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'create', T>>;
  update(id: string, input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'update', T>>;
  delete(id: string, ...collected: never[]): Promise<boolean>;
}

/** The prefab handler class — its ops, plus the statics the bootstrap and adapters read. */
export interface CrudConstructor<T, V = {}> {
  // `EntityOrm<T>`, not the bare `EntityOrm`: a handler that injects a second ORM has to
  // spell its own constructor, and `super(orm)` with the ORM the container hands it —
  // typed on the entity, as the `orm` property below already says — was refused.
  new (orm: EntityOrm<T>): CrudOps<T, V>;
  readonly __entity: unknown;
  readonly __output: unknown;
  readonly __opOutputs?: CrudViews;
  readonly __ops: Record<string, OperationContract>;
}

/**
 * Mixin — extends Crud(Entity) to get all 5 typed CRUD methods.
 *
 * The second argument (optional) names the view the ops emit, and comes in two
 * spellings of one idea — a view per op, or one view for all five:
 *
 * Crud(Post)                      → every op emits Post
 * Crud(Post, { list: PostCard })  → list emits cards, the rest emit Post. Declaration
 *                                   only: the handler keeps its full-row ORM, so a
 *                                   judge can still read `body`.
 * Crud(Post, PostPublic)          → every op emits PostPublic, and the bootstrap
 *                                   scopes the injected ORM via .output(PostPublic) —
 *                                   the whole handler speaks the restricted view.
 */
export function Crud<E extends abstract new (...args: any[]) => any, V extends CrudViews | SchemaCtor = {}>(
  entity: E,
  output?: V,
): CrudConstructor<InstanceType<E>, V> {
  // The entity() factory class IS the data type — no Infer needed.
  type T = InstanceType<E>;

  // A view is a class (it carries fields) ; a map of views is a plain object.
  const perOp = typeof output === 'object' && output !== null ? (output as CrudViews) : undefined;
  const wholeHandler = typeof output === 'function' ? (output as SchemaCtor) : undefined;

  return asCrudConstructor<T, V>(class CrudHandler {
    static __entity = entity;
    /** Handler-wide view only — a per-op map must NOT scope the ORM the judges read. */
    static __output = wholeHandler ?? entity;
    static __opOutputs = perOp;
    /** What this prefab handler declares — read by the façade, merged under the author's own methods. */
    static __ops: Record<string, OperationContract> = crudOps(entity as unknown as SchemaView & { partial?: () => SchemaView });

    orm: EntityOrm<T>;
    constructor(orm: EntityOrm) {
      this.orm = orm as EntityOrm<T>;
    }

    async list(options?: ListOptions): Promise<ListResult<T>> { return this.orm.list(options) as Promise<ListResult<T>>; }
    async findById(id: string): Promise<T | undefined> { return this.orm.findById(id); }
    async create(input: Partial<T>): Promise<T> { return this.orm.create(input); }
    async update(id: string, input: Partial<T>): Promise<T> { return this.orm.update(id, input); }
    async delete(id: string): Promise<boolean> { return this.orm.delete(id); }
  });
}
