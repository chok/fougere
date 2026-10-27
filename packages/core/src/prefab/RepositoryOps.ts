import { FieldSet, lowerFirst, type SchemaView } from '@fougere/schema';
import type { OperationContract } from '../wire/OperationContract.js';
import { targetOf } from './prefab.js';

/**
 * A class is recognized by what it ANSWERS — the five a repository brings — since TypeScript erases
 * what it extends the repository of.
 */
export function extendsRepository(ctor: unknown): boolean {
  const proto = (ctor as { prototype?: Record<string, unknown> } | undefined)?.prototype;

  return typeof proto?.list === 'function' && typeof proto?.findById === 'function';
}

/**
 * Storage follows the shape the handler was built on, which may differ from its address.
 * FR : le stockage suit la forme sur laquelle le handler est bâti, pas son adresse.
 * `subjectOf(seated(class Draft extends Repository<Post> {}, [Post]), 'draft')` → `'post'`
 */
export function subjectOf(ctor: unknown, address: string): string {
  const target = targetOf(ctor);

  return target?.name ? lowerFirst(target.name) : address;
}

/** The id of the row an op acts on — `id: Post['id']`, which a route places before the op. */
const byId = (entity: string, field: string) =>
  ({ name: 'id', source: { kind: 'param' as const, name: 'id', field: { entity, name: field }, identifies: entity }, optional: false });

const fromBody = { name: 'input', source: { kind: 'input' as const }, optional: false };

/** The same five, written as the scan would have written them. */
const idParam = (entity: string, field: string) =>
  ({ name: 'id', type: { raw: `${entity}['${field}']`, name: 'string', field: { entity, name: field }, identifies: entity } });

const inputParam = (entity: string) => ({ name: 'input', type: { raw: `Partial<${entity}>`, name: entity } });

const returns = (raw: string, name: string, extra?: { array?: boolean; nullable?: boolean }) =>
  ({ raw, name, ...extra });

/**
 * The five ops a repository brings a handler, declared rather than discovered.
 *
 * `output` says the entity, and saying it costs nothing at runtime.
 */
export function crudOps(entity: SchemaView & { partial?: () => SchemaView }): Record<string, OperationContract> {
  const name = (entity as { name?: string }).name ?? 'Entity';
  const input = inputParam(name);
  const primary = FieldSet.of(entity.getFields()).primary ?? 'id';
  const id = byId(name, primary);
  const idSignature = idParam(name, primary);

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
