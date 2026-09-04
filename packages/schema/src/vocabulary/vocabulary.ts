import { Field } from '../field/Field.js';
import { EXTENSION_SLOTS } from '../axis/Axis.js';
import { dequal } from 'dequal';

const MEMBER_SLOTS = [...EXTENSION_SLOTS, 'meta'] as const;

/**
 * So a word is one statement about a field, not a rebuilt field.
 * FR : pour qu'un mot soit une affirmation sur un champ, pas un champ reconstruit.
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
 * So two words that state the same member differently refuse instead of one winning.
 * FR : pour que deux mots contredisant un même membre refusent, plutôt qu'un l'emporte.
 * `readOnly(writeOnly(text()))` → both close a different side, so both apply
 */
function merge(name: string, field: Field, given: Partial<Field>): Partial<Field> {
  const merged: Record<string, unknown> = {};
  if ('shape' in given) merged.shape = given.shape;

  for (const slot of MEMBER_SLOTS) {
    const members = given[slot];
    if (members === undefined) continue;
    const already = field[slot] as Record<string, unknown> | undefined;
    if (typeof members !== 'object' || members === null || typeof already !== 'object') {
      merged[slot] = members;
      continue;
    }
    for (const [member, value] of Object.entries(members)) {
      const previous = already?.[member];
      if (previous === undefined || dequal(previous, value)) continue;
      throw new Error(
        `vocabulary: \`${name}\` states ${slot}.${member} = ${JSON.stringify(value)}, but the ` +
          `field already states ${JSON.stringify(previous)}. Apply one or the other, not both.`,
      );
    }
    merged[slot] = { ...already, ...members };
  }
  return merged as Partial<Field>;
}
