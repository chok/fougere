import { Field } from '../field/Field.js';
import type { SchemaView } from '../SchemaView.js';
import { RowJudge } from '../judge/RowJudge.js';

export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(
  of: E,
): Field<InstanceType<E>>;
/**
 * So a stored object can carry a schema, instead of admitting any shape forever.
 * FR : pour qu'un objet stocké porte un schéma, au lieu d'admettre toute forme à jamais.
 * `json(Address)` → the object's properties and its required keys
 */
export function json(of?: SchemaView): Field<unknown> {
  if (!of) return new Field({ shape: { type: 'object' } });
  const fields = of.getFields();
  const judge = RowJudge.of(fields);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(fields)) {
    properties[key] = field.meta?.description
      ? { ...field.shape, description: field.meta.description }
      : field.shape;
    if (judge.onAbsent(field) === null) required.push(key);
  }
  return new Field({
    shape: { type: 'object', properties, ...(required.length ? { required } : {}) },
  });
}
