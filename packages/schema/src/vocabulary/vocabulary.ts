import { Field } from '../Field.js';
import type { FieldData } from '../Field.js';

/** The axes held as member maps. `shape` is the carrier — a word replaces it whole. */
const MEMBER_SLOTS = ['role', 'lifecycle', 'boundary', 'meta'] as const;

/**
 * A vocabulary word that MODIFIES a field — `optional`, `immutable`, `unique`… Each states
 * the axis members it writes, and this applies them.
 *
 * A word is a COMPOSITION OF AXES, and that is what makes it worth materializing: two words
 * writing the same member used to resolve in silence, each in its own direction. `optional`
 * yielded (`create: field.lifecycle?.create ?? 'optional'`) so `optional(created())` stamped
 * anyway; `immutable` overwrote, so `immutable(updated())` never re-stamped. Both are legal
 * TypeScript, both lose what the author asked for, and neither said a word.
 *
 * ```ts
 * indexed(optional(text()))     // → fine: role.index and lifecycle.create are different members
 * immutable(primary(text()))    // → fine: both state update = 'forbidden', the same value
 * immutable(updated())          // → throws: update is already 'now'
 * ```
 *
 * Stating a member the field already holds AT THE SAME VALUE is legal — `primary` and
 * `immutable` both mean "an id does not move", and saying it twice is not a contradiction.
 */
export function vocabulary(
  name: string,
  states: (field: Field) => Partial<FieldData>,
): FieldWord {
  return (field) => field.with(merge(name, field, states(field)));
}

/**
 * What every word is. Each one ANNOTATES itself with the signature it really has, because
 * that signature is information: `optional` and `nullable` widen the value type, the others
 * leave it alone, and the reader sees which at the declaration.
 */
export type FieldWord = (field: Field<any>) => Field<any>;

/**
 * The merge every modifier shares — and the refusal. Public so an overloaded word
 * (`primary`, which both creates and modifies) states its members the same way.
 */
function merge(name: string, field: Field, stated: Partial<FieldData>): Partial<FieldData> {
  const out: Record<string, unknown> = {};
  if ('shape' in stated) out.shape = stated.shape;

  for (const slot of MEMBER_SLOTS) {
    const members = stated[slot];
    if (members === undefined) continue;
    const held = field[slot] as Record<string, unknown> | undefined;
    // A boundary may be an alias NAME, not a member map — then the word replaces it whole.
    if (typeof members !== 'object' || members === null || typeof held !== 'object') {
      out[slot] = members;
      continue;
    }
    for (const [member, value] of Object.entries(members)) {
      const previous = held?.[member];
      if (previous === undefined || same(previous, value)) continue;
      throw new Error(
        `vocabulary: \`${name}\` states ${slot}.${member} = ${JSON.stringify(value)}, but the ` +
          `field already states ${JSON.stringify(previous)}. Apply one or the other, not both.`,
      );
    }
    out[slot] = { ...held, ...members };
  }
  return out as Partial<FieldData>;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
