import { Field } from '../schema/fields/Field.js';
import type { SchemaView } from '../schema/SchemaView.js';
import { RowJudge } from '../judge/RowJudge.js';

export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(
  of: E,
): Field<InstanceType<E>>;
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
