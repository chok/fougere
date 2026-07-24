/**
 * Egress — what leaves a façade is what a client may read.
 *
 * `writeOnly` is a fact carried by the field's `boundary` axis, and every
 * surface reads it instead of restating the rule: REST does it in its
 * register, Pothos does it in its type map. The call contract is a surface
 * like the others — a password hash a handler legitimately read must not ride
 * the result out to a browser or to another frond.
 *
 * The dual of the judge: `validateFields` refuses on the way in, this omits on
 * the way out. Keys the schema knows nothing about (a presenter's computed
 * field) pass through untouched — an egress is a projection, not a filter.
 *
 * Shallow, like `encodeFields` it stands on: a relation's nested rows are not
 * reached. A handler that hand-rolls its own envelope owns its own egress.
 */
import { encodeFields, type Fields } from '@fougere/schema';

/**
 * An array's own non-index properties. `ListResult` IS an array — it carries
 * `hasMore`/`endCursor`/`total` on itself rather than wrapping the rows — so
 * mapping over it must not drop them.
 */
function arrayExtras(source: unknown[]): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (!/^\d+$/.test(key)) extras[key] = (source as unknown as Record<string, unknown>)[key];
  }
  return extras;
}

/** Project a façade result onto its output fields, whatever shape it takes. */
export function encodeEgress(fields: Fields, result: unknown): unknown {
  if (result === null || result === undefined) return result;

  if (Array.isArray(result)) {
    const rows = result.map((item) => encodeEgress(fields, item));
    return Object.assign(rows, arrayExtras(result));
  }

  // A scalar (the boolean from `delete`, an id) crosses untouched.
  if (typeof result !== 'object') return result;

  return encodeFields(fields, result as Record<string, unknown>);
}
