import type { Fields, SchemaLike } from '../field/index.js';
import type { SchemaDescriptor } from './card.js';
import { reconstruct } from './reconstruct.js';

/**
 * The two forms a schema reaches an adapter in — and the single reader that takes both.
 *
 * An adapter has never needed the class, only its fields. In-process it gets the class
 * because the class is there; from a remote or foreign frond it gets the card, because a
 * class does not cross a wire. Naming that union here is what lets one projection serve
 * both, instead of each adapter growing its own branch.
 *
 * The card was built for exactly this and had no in-repo reader: every adapter called
 * `getFields()` on the live class, so writing a Fougere adapter meant being inside the
 * repo, in TypeScript, with the class in hand.
 */
export type SchemaSource = SchemaLike | SchemaDescriptor;

/** A card is the plain document — no behaviour, so no `getFields`. */
function isDescriptor(source: SchemaSource): source is SchemaDescriptor {
  return typeof (source as SchemaLike).getFields !== 'function';
}

/**
 * The fields an adapter projects from, whichever form it was handed.
 *
 * Cost: nothing for a class. For a card, one `reconstruct` — measured at 6.5 µs for a
 * 17-field entity, paid once per entity when the adapter builds, never per request.
 * Callers that build repeatedly from the same card should hold the reconstructed schema,
 * not call this in a loop.
 */
export function fieldsOf(source: SchemaSource): Fields {
  return isDescriptor(source) ? reconstruct(source).getFields() : source.getFields();
}

/**
 * The composite unique groups, whichever form. A bare wrapper (a view mid-derivation)
 * carries no `getUnique`, and a card does not carry the groups at all yet — both answer
 * `undefined` rather than inventing a promise the storage would not keep.
 */
export function uniqueOf(source: SchemaSource): ReadonlyArray<ReadonlyArray<string>> | undefined {
  return isDescriptor(source) ? undefined : source.getUnique?.();
}
