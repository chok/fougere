import type { Fields } from '../field/index.js';
import type { SchemaView } from '../schema/index.js';
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
export type SchemaSource = SchemaView | SchemaDescriptor;

/** A card is the plain document — no behaviour, so no `getFields`. */
function isDescriptor(source: SchemaSource): source is SchemaDescriptor {
  return typeof (source as SchemaView).getFields !== 'function';
}

/**
 * Normalize a source to a live schema — reconstructing a card, passing a class through.
 *
 * This is what an adapter reaching for the schema MORE THAN ONCE should call, once, at its
 * boundary: `reconstruct` runs per call (6.5 µs for a 17-field entity), so a component that
 * reads fields in two places would otherwise rebuild the schema twice and hold two
 * unrelated field objects. Normalize at the edge, then nothing downstream knows the
 * difference — which is the point.
 */
export function schemaOf(source: SchemaSource): SchemaView {
  return isDescriptor(source) ? reconstruct(source) : source;
}

/** The fields an adapter projects from, whichever form it was handed. */
export function fieldsOf(source: SchemaSource): Fields {
  return schemaOf(source).getFields();
}
