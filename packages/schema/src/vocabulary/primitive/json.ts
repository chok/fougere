import { Field, type Shared } from '../../field/Field.js';
import type { SchemaView } from '../../SchemaView.js';
import { InputValidator } from '../../validator/InputValidator.js';

export function json<T = unknown>(opts?: Shared<T>): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(
  of: E,
  opts?: Shared<InstanceType<E>>,
): Field<InstanceType<E>>;

/**
 * `json(Address)` where the object has a shape; `json()` alone admits any shape forever.
 * `json(Address)` → the entity's properties, and its required keys
 */
export function json(of?: SchemaView | Shared<unknown>, opts?: Shared<unknown>): Field<unknown> {
  const hasSchema = typeof of === 'function';
  const schema = hasSchema ? (of as SchemaView) : undefined;
  const shared = hasSchema ? opts : (of as Shared<unknown> | undefined);
  if (!schema) return new Field({ shape: { type: 'object' } }).setShared(shared);
  const fields = schema.getFields();
  const validator = InputValidator.of(fields);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(fields)) {
    properties[key] = field.meta?.description
      ? { ...field.shape, description: field.meta.description }
      : field.shape;
    if (validator.onAbsent(field) === null) required.push(key);
  }
  return new Field({
    shape: { type: 'object', properties, ...(required.length ? { required } : {}) },
  }).setShared(shared);
}
