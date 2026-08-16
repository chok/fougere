import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import type { Fields } from '../Field.js';

/**
 * The two dual projections of a field set onto a client surface — membership only. The
 * create/patch MODE changes omissibility, which the view carries, never membership.
 *
 * ⚠️ The audience lives here and not in the data: no axis says "client". Surfaces are
 * supposed to read these two functions, and the GraphQL input, the judge and the CLI each
 * restate the rules with a different set — the judge being the most permissive.
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
    if (Lifecycle.of(field).create === 'now') continue;
    if (field.role?.relation?.kind === 'many') continue;
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
