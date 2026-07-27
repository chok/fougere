import type { Fields } from '../field/index.js';
import { boundaryOf } from '../field/index.js';

/**
 * The two dual projections of a field set onto a client surface — membership
 * only, derived from the axes.
 *
 * The create/patch MODE never changes membership, it only changes omissibility, which
 * the view (`partial()`) carries.
 *
 * ⚠️ The audience lives in this comment, not in the data — no axis says "client", so
 * these two functions are the only place the word exists. Surfaces are SUPPOSED to read
 * them instead of restating the rules, and several don't: the GraphQL public
 * `registerInput`, the runtime judge and the CLI each answer "what may a client supply"
 * with a different set. The judge is the most permissive — a client-forged primary key
 * reaches the ORM. Reconciling them needs the audience to become data.
 */

/**
 * Ingress: what a CLIENT may supply. Excluded —
 * - `role.primary`               → identity is system-owned
 * - `lifecycle.create === 'now'` → managed timestamps are stamped, not supplied
 * - `role.relation.kind 'many'`  → the collection lives on the other side
 * - `boundary.in === 'closed'`   → read-only, never accepted from a client
 */
export function inputFields(fields: Fields): Fields {
  const result: Fields = {};
  for (const [name, field] of Object.entries(fields)) {
    if (field.role?.primary) continue;
    if (field.lifecycle?.create === 'now') continue;
    if (field.role?.relation?.kind === 'many') continue;
    if (boundaryOf(field).in === 'closed') continue;
    result[name] = field;
  }
  return result;
}

/**
 * Egress: what a CLIENT may read. Excluded —
 * - `boundary.out === 'closed'` → write-only (password), never emitted
 * (`encodeFields` also omits them at runtime; types and payloads agree.)
 */
export function outputFields(fields: Fields): Fields {
  const result: Fields = {};
  for (const [name, field] of Object.entries(fields)) {
    if (boundaryOf(field).out === 'closed') continue;
    result[name] = field;
  }
  return result;
}
