import type { Storage, ListOptions, ListResult } from '../storage.js';
import type { OperationContract } from '../wire/operation.js';
import type { EntityConstructor, SchemaView } from '@fougere/schema';

/** The id of the row an op acts on — a route segment, or a query fallback. */
const byId = { name: 'id', source: { kind: 'param' as const, name: 'id' }, optional: false };
const fromBody = { name: 'input', source: { kind: 'input' as const }, optional: false };

/** The same five, written as the scan would have written them. */
const idParam = { name: 'id', type: { raw: 'string', name: 'string' } };
const inputParam = (entity: string) => ({ name: 'input', type: { raw: `Partial<${entity}>`, name: entity } });
const returns = (raw: string, name: string, extra?: { array?: boolean; nullable?: boolean }) =>
  ({ raw, name, ...extra });

/** The five ops a Crud handler brings, declared rather than discovered. */
/** `output` says the entity, and saying it costs nothing at runtime. */
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

/** The mixin's single "trust me" point — the twin of `asSchemaConstructor` in @fougere/schema. */
function asCrudConstructor<T, V>(impl: object): CrudConstructor<T, V> {
  return impl as CrudConstructor<T, V>;
}

/** The five ops the mixin fabricates. */
export type CrudOpName = 'list' | 'findById' | 'create' | 'update' | 'delete';

/** Which view each op speaks — omitted ops speak the entity, the trivial view. */
export type CrudViews = Partial<Record<CrudOpName, EntityConstructor>>;

/** The view an op emits, fabricated. */
type OutOf<V, K extends CrudOpName, T> =
  // Bracketed on purpose: a naked `V extends …` DISTRIBUTES, and the no-view default
  // is the empty map, whose `keyof` is `never` — distribution would then collapse
  // every op's output to `never` instead of falling through to the entity.
  [V] extends [EntityConstructor] ? InstanceType<V & EntityConstructor>
  : K extends keyof V ? (V[K] extends EntityConstructor ? InstanceType<V[K]> : T)
  : T;

/** The five ops, typed from the entity and its views. */
export interface CrudOps<T, V = {}> {
  storage: Storage<T>;
  list(options?: ListOptions, ...collected: never[]): Promise<ListResult<OutOf<V, 'list', T>>>;
  findById(id: string, ...collected: never[]): Promise<OutOf<V, 'findById', T> | undefined>;
  create(input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'create', T>>;
  update(id: string, input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'update', T>>;
  delete(id: string, ...collected: never[]): Promise<boolean>;
}

/** The prefab handler class — its ops, plus the statics the bootstrap and adapters read. */
export interface CrudConstructor<T, V = {}> {
  // `Storage<T>`, not the bare `Storage`: a handler that injects a second storage has to
  // spell its own constructor, and `super(storage)` with the storage the container hands it —
  // typed on the entity, as the `storage` property below already says — was refused.
  new (storage: Storage<T>): CrudOps<T, V>;
  readonly __entity: unknown;
  readonly __output: unknown;
  readonly __opOutputs?: CrudViews;
  readonly __ops: Record<string, OperationContract>;
}

/** Mixin — extends Crud(Entity) to get all 5 typed CRUD methods. */
export function Crud<E extends EntityConstructor, V extends CrudViews | EntityConstructor = {}>(
  entity: E,
  output?: V,
): CrudConstructor<InstanceType<E>, V> {
  // The entity() factory class IS the data type — no Infer needed.
  type T = InstanceType<E>;

  // A view is a class (it carries fields) ; a map of views is a plain object.
  const perOp = typeof output === 'object' && output !== null ? (output as CrudViews) : undefined;
  const wholeHandler = typeof output === 'function' ? (output as EntityConstructor) : undefined;

  return asCrudConstructor<T, V>(class CrudHandler {
    static __entity = entity;
    /** Handler-wide view only — a per-op map must NOT scope the storage the validators read. */
    static __output = wholeHandler ?? entity;
    static __opOutputs = perOp;
    /**
     * What this prefab handler declares — read by the façade, merged under the author's own
     * methods.
     */
    static __ops: Record<string, OperationContract> = crudOps(entity as unknown as SchemaView & { partial?: () => SchemaView });

    storage: Storage<T>;
    constructor(storage: Storage) {
      this.storage = storage as Storage<T>;
    }

    async list(options?: ListOptions): Promise<ListResult<T>> { return this.storage.list(options) as Promise<ListResult<T>>; }
    async findById(id: string): Promise<T | undefined> { return this.storage.findById(id); }
    async create(input: Partial<T>): Promise<T> { return this.storage.create(input); }
    async update(id: string, input: Partial<T>): Promise<T> { return this.storage.update(id, input); }
    async delete(id: string): Promise<boolean> { return this.storage.delete(id); }
  });
}
