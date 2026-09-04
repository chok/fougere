import { Shapes } from '../axis/shape/Shape.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Field } from '../field/Field.js';
import type { SchemaView } from '../SchemaView.js';
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
  /** Judged as an update rather than a creation. The two modes refuse different things: */
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
  // Through `Shapes`, not a cast: the cast admitted any keyword, and it declared
  // `maxItems` — which no branch below ever produced. In the one function whose job is
  // to be exhaustive, a bound the type does not carry is a case nobody notices missing.
  const shape = Shapes.of(field.shape).base;
  const cases: { why: string; value: unknown }[] = [];
  if (shape?.type === 'string') {
    if (typeof shape.minLength === 'number' && shape.minLength > 0)
      cases.push({ why: 'shorter than min', value: 'x'.repeat(shape.minLength - 1) });
    if (typeof shape.maxLength === 'number')
      cases.push({ why: 'longer than max', value: 'x'.repeat(shape.maxLength + 1) });
    if (shape.enum) cases.push({ why: 'outside the stated set', value: '__not-in-enum__' });
  }
  if (shape?.type === 'number' || shape?.type === 'integer') {
    if (typeof shape.minimum === 'number')
      cases.push({ why: 'below minimum', value: shape.minimum - 1 });
    if (typeof shape.maximum === 'number')
      cases.push({ why: 'above maximum', value: shape.maximum + 1 });
  }
  if (shape?.type === 'array') {
    if (typeof shape.minItems === 'number' && shape.minItems > 0)
      cases.push({ why: 'fewer items than min', value: [] });
    if (typeof shape.maxItems === 'number')
      cases.push({
        why: 'more items than max',
        value: Array.from({ length: shape.maxItems + 1 }, () => null),
      });
  }
  return cases;
}

/**
 * The decision table, enumerated on the entity's own fields.
 *
 * Use the complete entity so a derived view cannot hide a divergent field. The caller
 * supplies a valid row; generating data belongs to the testing package.
 */
export class Cases {
  private constructor(readonly all: readonly ValidationCase[]) {}

  static of(entity: SchemaView, valid: Record<string, unknown>): Cases {
    return new Cases(enumerate(entity, valid));
  }

  static holds(
    expected: ValidationCase['expect'],
    result: { success: boolean; errors?: { path: string }[] },
  ): boolean {
    if (expected === 'accept') return result.success;
    if (result.success) return false;
    return (result.errors ?? []).some((error) => error.path === expected.reject);
  }

  static get refusals(): string[] {
    return Object.values(RowRefusal);
  }

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
