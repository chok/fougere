import { Field } from '../Field.js';
import { EXTENSION_SLOTS } from '../axis/Axis.js';
import { dequal } from 'dequal';

const MEMBER_SLOTS = [...EXTENSION_SLOTS, 'meta'] as const;

export function vocabulary(
  name: string,
  states: (field: Field) => Partial<Field>,
): FieldWord {
  return (field) => field.with(merge(name, field, states(field)));
}

export type FieldWord = (field: Field<any>) => Field<any>;

function merge(name: string, field: Field, stated: Partial<Field>): Partial<Field> {
  const out: Record<string, unknown> = {};
  if ('shape' in stated) out.shape = stated.shape;

  for (const slot of MEMBER_SLOTS) {
    const members = stated[slot];
    if (members === undefined) continue;
    const held = field[slot] as Record<string, unknown> | undefined;
    if (typeof members !== 'object' || members === null || typeof held !== 'object') {
      out[slot] = members;
      continue;
    }
    for (const [member, value] of Object.entries(members)) {
      const previous = held?.[member];
      if (previous === undefined || dequal(previous, value)) continue;
      throw new Error(
        `vocabulary: \`${name}\` states ${slot}.${member} = ${JSON.stringify(value)}, but the ` +
          `field already states ${JSON.stringify(previous)}. Apply one or the other, not both.`,
      );
    }
    out[slot] = { ...held, ...members };
  }
  return out as Partial<Field>;
}

