import type { EntityOrm, ListOptions, ListResult } from './orm.js';

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

/**
 * Create a CRUD handler class for an entity.
 * DI deps are declared externally by the bootstrap (no param name hack needed).
 */
export function CrudFor(_entityName: string, entity: abstract new (...args: any[]) => any) {
  return Crud(entity);
}
