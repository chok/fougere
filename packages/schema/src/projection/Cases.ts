import { Anatomy } from '../schema/axis/shape/Shape.js';
import { Boundary } from '../schema/axis/boundary/Boundary.js';
import { Lifecycle } from '../schema/axis/lifecycle/Lifecycle.js';
import { Role } from '../schema/axis/role/Role.js';
import type { Field } from '../schema/fields/Field.js';
import type { SchemaView } from '../schema/SchemaView.js';
import { RowJudge } from '../judge/RowJudge.js';
import { RowRefusal } from '../judge/RowRefusal.js';

/**
 * One input, and what the judge must answer.
 *
 * `expect` carries the PATH of the field at fault and never the message. We know which
 * field must be refused because we are the ones who broke it; naming the message would
 * make this list a second judge, and the two would then have to be kept in step by hand —
 * which is the duplication the whole thing exists to remove.
 */
export interface ValidationCase {
  /** What this input does, in one clause — carried into the assertion so a failure reads. */
  why: string;
  body: unknown;
  /**
   * Judged as an update rather than a creation. The two modes refuse different things:
   * an absence is `Required` on create and legal on patch, an immutable field is legal
   * on create and refused on patch.
   */
  patch: boolean;
  expect: 'accept' | { reject: string };
}

/**
 * So every field has at least one case, whatever else it declares.
 * FR : pour que chaque champ ait un cas, quoi qu'il déclare par ailleurs.
 * `text()` → `42`; `number()` → `'not-a-value-of-this-shape'`
 */
function wrongTypeFor(field: Field): unknown {
  const declared = (field.shape as { type?: string | readonly string[] }).type;
  const names = Array.isArray(declared) ? declared : [declared];
  return names.includes('string') ? 42 : 'not-a-value-of-this-shape';
}

/**
 * So a bound stated in a shape produces the case that breaks it, and none is invented.
 * FR : pour qu'une borne énoncée produise le cas qui la casse, et aucun autre.
 * `text({ maxLength: 3 })` → one case with `'xxxx'`; `text()` → no case
 */
function outOfBoundsFor(field: Field): { why: string; value: unknown }[] {
  // Through `Anatomy`, not a cast: the cast admitted any keyword, and it declared
  // `maxItems` — which no branch below ever produced. In the one function whose job is
  // to be exhaustive, a bound the type does not carry is a case nobody notices missing.
  const shape = Anatomy.of(field.shape).base;
  const out: { why: string; value: unknown }[] = [];
  if (shape?.type === 'string') {
    if (typeof shape.minLength === 'number' && shape.minLength > 0)
      out.push({ why: 'shorter than min', value: 'x'.repeat(shape.minLength - 1) });
    if (typeof shape.maxLength === 'number')
      out.push({ why: 'longer than max', value: 'x'.repeat(shape.maxLength + 1) });
    if (shape.enum) out.push({ why: 'outside the stated set', value: '__not-in-enum__' });
  }
  if (shape?.type === 'number' || shape?.type === 'integer') {
    if (typeof shape.minimum === 'number')
      out.push({ why: 'below minimum', value: shape.minimum - 1 });
    if (typeof shape.maximum === 'number')
      out.push({ why: 'above maximum', value: shape.maximum + 1 });
  }
  if (shape?.type === 'array') {
    if (typeof shape.minItems === 'number' && shape.minItems > 0)
      out.push({ why: 'fewer items than min', value: [] });
    if (typeof shape.maxItems === 'number')
      out.push({
        why: 'more items than max',
        value: Array.from({ length: shape.maxItems + 1 }, () => null),
      });
  }
  return out;
}

/**
 * The decision table, enumerated on the entity's own fields.
 *
 * Use the complete entity so a derived view cannot hide a divergent field. The caller
 * supplies a valid row; generating data belongs to the testing package.
 */
export class Cases {
  private constructor(readonly all: readonly ValidationCase[]) {}

  /**
   * So a test suite is derived from the entity instead of written field by field.
   * FR : pour qu'une suite soit dérivée de l'entité, pas écrite champ par champ.
   * `Cases.of(Post, { title: 'a' })` → the valid row, the unknown key, and one case per field
   */
  static of(entity: SchemaView, valid: Record<string, unknown>): Cases {
    return new Cases(enumerate(entity, valid));
  }

  /**
   * So the local judge, the façade and a door are all read by one same assertion.
   * FR : pour que le juge local, la façade et une porte partagent une assertion.
   * `holds({ reject: 'title' }, result)` → `true` when an error carries that path
   */
  static holds(
    expected: ValidationCase['expect'],
    result: { success: boolean; errors?: { path: string }[] },
  ): boolean {
    if (expected === 'accept') return result.success;
    if (result.success) return false;
    return (result.errors ?? []).some((error) => error.path === expected.reject);
  }

  /**
   * So a suite can assert it covers the closed set, rather than the messages it happened to see.
   * FR : pour qu'une suite prouve qu'elle couvre l'ensemble fermé.
   * `Cases.refusals` → `['Expected an object', 'Unknown field', 'Required', …]`
   */
  static get refusals(): string[] {
    return Object.values(RowRefusal);
  }

  /**
   * So a suite writes `for (const c of cases)` without reaching for `.all`.
   * FR : pour qu'une suite écrive `for (const c of cases)` sans passer par `.all`.
   * `for (const { why, body } of Cases.of(Post, valid))`
   */
  [Symbol.iterator](): Iterator<ValidationCase> {
    return this.all[Symbol.iterator]();
  }
}

/**
 * So the four axes decide which cases exist, and no list of them is maintained by hand.
 * FR : pour que les axes décident des cas, sans liste tenue à la main.
 */
function enumerate(entity: SchemaView, valid: Record<string, unknown>): ValidationCase[] {
  const fields = entity.getFields();
  const judge = RowJudge.of(fields);
  const cases: ValidationCase[] = [];
  const withField = (name: string, value: unknown) => ({ ...valid, [name]: value });

  cases.push({ why: 'a valid body', body: valid, patch: false, expect: 'accept' });
  cases.push({
    why: 'a key outside the contract',
    body: { ...valid, __unknown__: 'x' },
    patch: false,
    expect: { reject: '__unknown__' },
  });
  cases.push({
    why: 'not an object at all',
    body: 'a string',
    patch: false,
    expect: { reject: '.' },
  });

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    // A reference names a row that must exist; the caller supplied its id and we do not
    // get to invent a second one, so the only case we can state about it is the bound one.
    const isRef = Role.of(field).isReference;

    if (judge.onAbsent(field) === null && name in valid) {
      const body = { ...valid };
      delete body[name];
      cases.push({ why: `${name} absent`, body, patch: false, expect: { reject: name } });
    }

    if (Boundary.of(field).readOnly) {
      cases.push({
        why: `${name} supplied although read-only`,
        body: withField(name, wrongTypeFor(field)),
        patch: false,
        expect: { reject: name },
      });
    }

    if (Lifecycle.of(field).immutable && !Role.of(field).isPrimary) {
      cases.push({
        why: `${name} supplied on an update`,
        body: { [name]: valid[name] ?? wrongTypeFor(field) },
        patch: true,
        expect: { reject: name },
      });
    }

    if (name in valid && !isRef) {
      cases.push({
        why: `${name} of the wrong type`,
        body: withField(name, wrongTypeFor(field)),
        patch: false,
        expect: { reject: name },
      });
      for (const { why, value } of outOfBoundsFor(field))
        cases.push({
          why: `${name} ${why}`,
          body: withField(name, value),
          patch: false,
          expect: { reject: name },
        });
    }
  }

  return cases;
}
