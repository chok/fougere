import { Field, type Shared } from '../../field/Field.js';
import type { SchemaView } from '../../SchemaView.js';
import { InputValidator } from '../../validator/InputValidator.js';
import { isObject } from '../../lib/utils.js';
import { SchemaError } from '../../SchemaError.js';

type Entity = SchemaView & (new (...args: never[]) => unknown);

export function json<T = unknown>(opts?: Shared<T>): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(
  of: E,
  opts?: Shared<InstanceType<E>>,
): Field<InstanceType<E>>;

/**
 * `json(Address)` → the entity's properties, and its required keys
 */
export function json(
  of?: Entity | Shared<unknown>,
  opts?: Shared<unknown>,
): Field<unknown> {
  const [schema, shared] = typeof of === 'function' ? [of, opts] : [undefined, of];

  if (shared !== undefined && !isObject(shared))
    throw new SchemaError('json() takes its options as an object', { received: shared });

  if (schema && typeof schema.getFields !== 'function')
    throw new SchemaError(
      'json() takes an entity, such as json(Address) — got a function that is not one',
    );

  if (!schema) return new Field({ shape: { type: 'object' } }).setShared(shared);

  const fields = schema.getFields();
  const validator = InputValidator.of(fields);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(fields)) {
    properties[key] = field.meta?.description
      ? { ...field.shape, description: field.meta.description }
      : field.shape;

    if (validator.requires(field)) required.push(key);
  }

  return new Field({
    shape: { type: 'object', properties, ...(required.length ? { required } : {}) },
  }).setShared(shared);
}
