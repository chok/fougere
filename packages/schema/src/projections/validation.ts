import type { Field, Fields } from '../field/index.js';
import { boundaryOf, resolveBoundary } from '../field/index.js';
import { checkValue, type ValidationError, type ValidationResult } from './check-value.js';

/**
 * Judging an INPUT object against a field map — membership, absence and the axes that
 * decide who may speak. A key outside the contract is refused, never stripped. Absence is
 * answered by `lifecycle.create`: any rule makes it legal and the field is OMITTED, never
 * filled — realising the rule belongs to the storage at the point of persistence.
 */

export type { ValidationError, ValidationResult } from './check-value.js';

export interface ValidateOptions {
  /**
   * Patch mode (update). An absent field is OMITTED from the result — not filled,
   * not required — so `validate({ name })` touches only `name`. Set by `partial()`.
   * Distinguishes "absent → don't touch" (patch) from "absent → null" (create).
   */
  patch?: boolean;
}

/**
 * A path is a field NAME here, never a dotted trail: `json(Entity)` is judged as one
 * opaque shape by the engine, so a nested failure answers `{ path: 'addr' }` with the
 * inner field in the prose. This used to take a `pathPrefix` that every call site passed
 * as `''` — a parameter for a recursion nobody wrote, which made the code read as if
 * nesting were handled. Writing that recursion changes what `FougereError.details`
 * carries across processes and languages, so it is a contract decision, not a patch.
 */
export function validateFields(
  fields: Fields,
  input: unknown,
  opts: ValidateOptions = {},
): ValidationResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: [{ path: '.', message: 'Expected an object' }] };
  }

  const data = input as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const out: Record<string, unknown> = {};

  // Refuse, never strip: a key outside the contract is an error, not a silent
  // drop. The client derives from the same contract (a form cannot emit a
  // foreign key), so a stranger is a bug or an attack — both deserve the 400.
  // Stripping would also let the envelope diverge from GraphQL, which refuses
  // unknown input keys by construction.
  //
  // A FACT is judged by this same rule, deliberately — the one place it was tempting to
  // relax it. A subscriber's copy of a fact can be older than the sender's, so tolerating
  // a stranger key would let a rolling deployment through; it would also mean a reader
  // silently ignoring a field it was supposed to handle. If the judge refuses, that is
  // the end of it: the sender re-syncs its readers before it ships.
  for (const key of Object.keys(data)) {
    if (!(key in fields)) {
      errors.push({ path: key, message: 'Unknown field' });
    }
  }

  for (const [key, field] of Object.entries(fields)) {
    const path = key;
    const value = data[key];

    if (value === undefined) {
      if (opts.patch) continue; // patch: an unsent field is left untouched
      // A read-only field is server-owned: its absence from a client input is
      // never "Required" (same stance as OpenAPI readOnly+required).
      if (boundaryOf(field).in === 'closed') continue;
      // Absence is answered by `lifecycle.create` — a key access on the normal
      // form. The judge only asks "is there a rule?": any rule ('now',
      // 'optional', { value }, { generate }) makes absence legal, and the field
      // is omitted from the result. Realisation is the storage adapter's role.
      if (field.lifecycle?.create !== undefined) continue;
      // No create rule: a `many` relation defaults to the empty collection
      // (graph semantics, read on `role` — never a shared `{ value: [] }`).
      if (field.role?.relation?.kind === 'many') { out[key] = []; continue; }
      errors.push({ path, message: 'Required' });
      continue;
    }

    // A PRESENT value can be illegal by an axis other than shape:
    // boundary `in: 'closed'` — a read-only field never crosses inbound;
    // lifecycle `update: 'forbidden'` — re-supplying an immutable field in a patch.
    if (boundaryOf(field).in === 'closed') {
      errors.push({ path, message: 'Read-only' });
      continue;
    }
    if (opts.patch && field.lifecycle?.update === 'forbidden') {
      errors.push({ path, message: 'Immutable' });
      continue;
    }

    // The shape predicate judges the value — null included, via the `[T,'null']`
    // union. Then the boundary's decode converts wire→domain; null skips decode
    // (a legal null is already the domain value, there is nothing to convert).
    const checked = checkValue(field, value);
    if ('error' in checked) {
      errors.push({ path, message: checked.error });
      continue;
    }
    if (checked.value === null) {
      out[key] = null;
      continue;
    }
    const decoded = resolveBoundary(field).decode(checked.value);
    if ('error' in decoded) errors.push({ path, message: decoded.error });
    else out[key] = decoded.value;
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: out };
}
