import type { EntityOrm, ListOptions, ListResult } from './orm.js';
import type { OperationContract } from './operation.js';
import type { SchemaLike } from '@fougere/schema';

/** The id of the row an op acts on — a route segment, or a query fallback. */
const byId = { name: 'id', source: { kind: 'param' as const, name: 'id' }, optional: false };
const fromBody = { name: 'input', source: { kind: 'body' as const }, optional: false };

/**
 * The five ops a Crud handler brings, declared rather than discovered.
 *
 * The mixin built them, so it alone knows their contract in full: what judges
 * their input, where each argument comes from. It says so on the class, at
 * runtime — which is what makes the guarantee independent of the AST scan (an
 * installed app cannot resolve this file, and never needs to).
 */
function crudOps(entity: SchemaLike & { partial?: () => SchemaLike }): Record<string, OperationContract> {
  return {
    list: { binding: [{ name: 'options', source: { kind: 'query' }, optional: true }] },
    findById: { binding: [byId] },
    create: { input: entity, binding: [fromBody] },
    // The patch view carries its own mode: an absent field is untouched, an
    // immutable one re-supplied is refused.
    update: { input: entity.partial?.(), binding: [byId, fromBody] },
    delete: { binding: [byId] },
  };
}

/**
 * Mixin — extends Crud(Entity) or Crud(Entity, Output) to get all 5 typed CRUD methods.
 *
 * The second argument (optional) restricts the output type. When provided,
 * the bootstrap scopes the injected ORM via .output(Output) so all reads
 * return only the fields declared in Output.
 *
 * Crud(Post)              → input = Partial<Post>, output = Post
 * Crud(Post, PostPublic)  → input = Partial<Post>, output = PostPublic
 */
export function Crud<E extends abstract new (...args: any[]) => any>(
  entity: E,
  output?: abstract new (...args: any[]) => any,
) {
  // The entity() factory class IS the data type — no Infer needed.
  type T = InstanceType<E>;

  return class CrudHandler {
    static __entity = entity;
    static __output = output ?? entity;
    /** What this prefab handler declares — read by the façade, merged under the author's own methods. */
    static __ops: Record<string, OperationContract> = crudOps(entity as unknown as SchemaLike & { partial?: () => SchemaLike });

    orm: EntityOrm<T>;
    constructor(orm: EntityOrm) {
      this.orm = orm as EntityOrm<T>;
    }

    async list(options?: ListOptions): Promise<ListResult<T>> { return this.orm.list(options) as Promise<ListResult<T>>; }
    async findById(id: string): Promise<T | undefined> { return this.orm.findById(id); }
    async create(input: Partial<T>): Promise<T> { return this.orm.create(input); }
    async update(id: string, input: Partial<T>): Promise<T> { return this.orm.update(id, input); }
    async delete(id: string): Promise<boolean> { return this.orm.delete(id); }
  };
}
