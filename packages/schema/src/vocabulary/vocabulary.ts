import { Field } from '../field/Field.js';
import { Axes } from '../axis/Axes.js';
import { dequal } from 'dequal';
import { SchemaError } from '../SchemaError.js';

/**
 * Builds a `rule/` word
 * `vocabulary('indexed', () => ({ role: { index: true } }))`
 */
export function vocabulary(
  name: string,
  states: (field: Field) => Partial<Field>,
): FieldWord {
  return (field) => field.with(merge(name, field, states(field)));
}

export type FieldWord = (field: Field<any>) => Field<any>;

/**
 * Refuses two words stating one member differently, rather than letting the outer win.
 * `readOnly(writeOnly(text()))` → both apply; `immutable(created())` → throws
 */
function merge(name: string, field: Field, given: Partial<Field>): Partial<Field> {
  const merged: Record<string, unknown> = {};
  const stated = given as Record<string, unknown>;
  if ('shape' in given) merged.shape = given.shape;

  for (const slot of Axes.names) {
    const members = stated[slot];
    if (members === undefined) continue;
    const already = field.stated(slot) as Record<string, unknown> | undefined;
    if (typeof members !== 'object' || members === null || typeof already !== 'object') {
      merged[slot] = members;
      continue;
    }
    for (const [member, value] of Object.entries(members)) {
      const previous = already?.[member];
      if (previous === undefined || dequal(previous, value)) continue;
      throw new SchemaError(
        `vocabulary: \`${name}\` states ${slot}.${member} = ${JSON.stringify(value)}, but the ` +
          `field already states ${JSON.stringify(previous)}. Apply one or the other, not both.`,
      );
    }
    merged[slot] = { ...already, ...members };
  }

  return merged as Partial<Field>;
}
