import type { Fields } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import type { SchemaDescriptor } from '../card/Descriptor.js';
import { reconstruct } from '../card/reconstruct.js';

/**
 * The two forms a schema reaches an adapter in. In-process it gets the class; from a
 * remote or foreign frond it gets the card, because a class does not cross a wire. Naming
 * the union is what lets one projection serve both.
 */
export type SchemaSource = SchemaView | SchemaDescriptor;

/** A card is the plain document — no behaviour, so no `getFields`. */
function isDescriptor(source: SchemaSource): source is SchemaDescriptor {
  return typeof (source as SchemaView).getFields !== 'function';
}

/**
 * Normalize a source to a live schema. Call it ONCE, at the adapter's boundary:
 * `reconstruct` runs per call (6.5 µs for 17 fields), so reading fields in two places
 * would rebuild the schema twice and hold two unrelated field objects.
 */
export function schemaOf(source: SchemaSource): SchemaView {
  return isDescriptor(source) ? reconstruct(source) : source;
}

/** The fields an adapter projects from, whichever form it was handed. */
export function fieldsOf(source: SchemaSource): Fields {
  return schemaOf(source).getFields();
}
