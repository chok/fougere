import { Role } from '../axis/role/Role.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import type { Fields } from '../Field.js';

/**
 * The two dual projections of a field set onto a client surface — membership only. The
 * create/patch MODE changes omissibility, which the view carries, never membership.
 *
 * ⚠️ The audience lives here and not in the data: no axis says "client".
 *
 * The judge is deliberately more permissive: these two answer "what do we ASK for", the
 * judge answers "what do we REFUSE", and a supplied id is legal.
 *
 * `adapter/graphql`'s `registerInput` applies TWO of the four clauses and that is not a
 * divergence: a collection has no column to send and `boundary in: 'closed'` is refused
 * from any client, while identity and `created()` are a CREATION policy. Its op path
 * calls this function for create/update alone, because `publish(input: Post)` must still
 * name the post. Making `registerInput` call this unconditionally was tried on
 * 2026-08-19 and reverted — `PublishPostInput` lost its `id`.
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
    if (Role.of(field).isPrimary) continue;
    if (Lifecycle.of(field).create === 'now') continue;
    if (Role.of(field).isCollection) continue;
    if (Boundary.of(field).readOnly) continue;
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
    if (Boundary.of(field).writeOnly) continue;
    result[name] = field;
  }
  return result;
}
