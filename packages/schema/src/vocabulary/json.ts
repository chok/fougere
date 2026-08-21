import { Field } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import { Judge } from '../judge/Judge.js';

export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(of: E): Field<InstanceType<E>>;
export function json(of?: SchemaView): Field<unknown> {
  if (!of) return new Field({ shape: { type: 'object' } });
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(of.getFields())) {
    properties[key] = field.meta?.description
      ? { ...field.shape, description: field.meta.description }
      : field.shape;
    if (Judge.onAbsent(field) === null) required.push(key);
  }
  return new Field({
    shape: { type: 'object', properties, ...(required.length ? { required } : {}) },
  });
}
