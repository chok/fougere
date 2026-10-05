import { FieldSet, lowerFirst, type Entity, type SchemaView } from '@fougere/schema';
import type { ListOptions } from '../storage/ListOptions.js';
import type { Storage } from '../storage/Storage.js';
import type { OperationContract } from '../wire/OperationContract.js';
import { targetOf } from './prefab.js';
import type { CrudViews } from './CrudViews.js';
import { pageOf, type Page } from '../wire/Page.js';
import type { CrudOps } from './CrudOps.js';

/**
 * A class is recognized by what it ANSWERS — the mixin leaves no other trace.
 * FR : une classe se reconnaît à ce qu'elle répond, le mixin ne laissant rien d'autre.
 * `inheritsCrud(class PostHandler extends Crud(Post) {})` → `true`
 */
export function inheritsCrud(ctor: unknown): boolean {
  const proto = (ctor as { prototype?: Record<string, unknown> } | undefined)?.prototype;

  return typeof proto?.list === 'function' && typeof proto?.findById === 'function';
}

/**
 * Storage follows the shape the handler was built on, which may differ from its address.
 * FR : le stockage suit la forme sur laquelle le handler est bâti, pas son adresse.
 * `subjectOf(class Draft extends Crud(Post) {}, 'draft')` → `'post'`
 */
export function subjectOf(ctor: unknown, address: string): string {
  const target = targetOf(ctor);

  return target?.name ? lowerFirst(target.name) : address;
}

/** The id of the row an op acts on — `id: Post['id']`, which a route places before the op. */
const byId = (entity: string) =>
  ({ name: 'id', source: { kind: 'param' as const, name: 'id', identifies: entity }, optional: false });

const fromBody = { name: 'input', source: { kind: 'input' as const }, optional: false };

/** The same five, written as the scan would have written them. */
const idParam = (entity: string, field: string) =>
  ({ name: 'id', type: { raw: `${entity}['${field}']`, name: 'string', identifies: { entity, field } } });

const inputParam = (entity: string) => ({ name: 'input', type: { raw: `Partial<${entity}>`, name: entity } });

const returns = (raw: string, name: string, extra?: { array?: boolean; nullable?: boolean }) =>
  ({ raw, name, ...extra });

/**
 * The five ops a Crud handler brings, declared rather than discovered.
 *
 * `output` says the entity, and saying it costs nothing at runtime.
 */
function crudOps(entity: SchemaView & { partial?: () => SchemaView }): Record<string, OperationContract> {
  const name = (entity as { name?: string }).name ?? 'Entity';
  const input = inputParam(name);
  const id = byId(name);
  const idSignature = idParam(name, FieldSet.of(entity.getFields()).primary ?? 'id');

  return {
    list: {
      output: entity, cardinality: 'page',
      binding: [{ name: 'options', source: { kind: 'query' }, optional: true }],
      signature: {
        name: 'list', returnType: returns(`Page<${name}>`, 'Page'),
        params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
      },
    },
    findById: {
      output: entity, cardinality: 'maybe', binding: [id],
      signature: { name: 'findById', returnType: returns(`${name} | undefined`, name, { nullable: true }), params: [idSignature] },
    },
    create: {
      input: entity, output: entity, cardinality: 'one', binding: [fromBody],
      signature: { name: 'create', returnType: returns(name, name), params: [input] },
    },
    // The patch view carries its own mode: an absent field is untouched, an
    // immutable one re-supplied is refused.
    update: {
      input: entity.partial?.(), output: entity, cardinality: 'one', binding: [id, fromBody],
      signature: { name: 'update', returnType: returns(name, name), params: [idSignature, input] },
    },
    delete: {
      cardinality: 'none', binding: [id],
      signature: { name: 'delete', returnType: returns('boolean', 'boolean'), params: [idSignature] },
    },
  };
}

/** The mixin's single "trust me" point — the twin of `asSchemaConstructor` in @fougere/schema. */
function asCrudConstructor<T, V>(impl: object): CrudConstructor<T, V> {
  return impl as CrudConstructor<T, V>;
}

/** The prefab handler class — its ops, plus the statics the bootstrap and adapters read. */
export interface CrudConstructor<T, V = {}> {
  // What the container hands is the entity's REPOSITORY (`<Entity>Repository`), typed as the
  // port it forwards: a handler with a constructor of its own passes it on — `super(posts)` —
  // and reaches its named queries through the field it declares, never through the prefab.
  new (repository: Storage<T>): CrudOps<T, V>;
  readonly __entity: unknown;
  readonly __output: unknown;
  readonly __opOutputs?: CrudViews;
  readonly __ops: Record<string, OperationContract>;
}

/**
 * Mixin — extends Crud(Entity) to get all 5 typed CRUD methods.
 *
 * Documented: [handlers](https://fougere.dev/docs/business/handlers).
 */
export function Crud<E extends Entity, V extends CrudViews | Entity = {}>(
  entity: E,
  output?: V,
): CrudConstructor<InstanceType<E>, V> {
  // The entity() factory class IS the data type — no Infer needed.
  type T = InstanceType<E>;

  // A view is a class (it carries fields) ; a map of views is a plain object.
  const perOp = typeof output === 'object' && output !== null ? (output as CrudViews) : undefined;
  const wholeHandler = typeof output === 'function' ? (output as Entity) : undefined;

  return asCrudConstructor<T, V>(class CrudHandler {
    static __entity = entity;
    /** Handler-wide view only — a per-op map must NOT scope the storage the validators read. */
    static __output = wholeHandler ?? entity;
    static __opOutputs = perOp;
    /**
     * What this prefab handler declares — read by the façade, merged under the author's own
     * methods.
     */
    static __ops: Record<string, OperationContract> = crudOps(entity);

    // Private: the five ops are how a subclass reaches the rows — `super.findById(id)` — and a
    // query worth a name belongs to the repository, which it asks for like any handler does.
    readonly #rows: Storage<T>;
    constructor(repository: Storage) {
      this.#rows = repository as Storage<T>;
    }

    async list(options?: ListOptions): Promise<Page<T>> { return pageOf(await this.#rows.list(options)); }
    async findById(id: string): Promise<T | undefined> { return this.#rows.findById(id); }
    async create(input: Partial<T>): Promise<T> { return this.#rows.create(input); }
    async update(id: string, input: Partial<T>): Promise<T> { return this.#rows.update(id, input); }
    async delete(id: string): Promise<boolean> { return this.#rows.delete(id); }
  });
}
