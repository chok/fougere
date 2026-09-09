import { Field } from '../../field/Field.js';
import type { SchemaView } from '../../SchemaView.js';
import { InputValidator } from '../../validator/InputValidator.js';

export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(
  of: E,
): Field<InstanceType<E>>;
/**
 * `json(Address)` where the object has a shape; `json()` alone admits any shape forever.
 * FR : `json(Address)` quand l'objet a une forme ; `json()` seul admet tout, à jamais.
 * `json(Address)` → the entity's properties, and its required keys
 */
export function json(of?: SchemaView): Field<unknown> {
  if (!of) return new Field({ shape: { type: 'object' } });
  const fields = of.getFields();
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
  });
}
